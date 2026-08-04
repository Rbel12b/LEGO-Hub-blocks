import type { Transport } from "../transport/types";
import { HubProtocol, validatePath, type UploadPolicy } from "./protocol";
import { sanitizeFilename } from "../utils/sanitize";

export type ConsoleSink = (text: string) => void;

export interface RunOptions {
  onStdout?: ConsoleSink;
  timeoutMs?: number;
}

export interface UploadRunOptions {
  policy: UploadPolicy;
  autoRun?: boolean;
  onProgress?: (sent: number, total: number) => void;
  onStdout?: ConsoleSink;
}

export interface UploadResult {
  path: string;
  length: number;
}

const TMP_RUN_NAME = "__web_run.py";

/**
 * High-level device operations over the HubProtocol side channel.
 * `run(code)` uploads the source as a temp file and asks the on-device runner
 * to execute it via `runner.run_program(path)`. No raw REPL anywhere.
 */
export class DeviceClient {
  private proto: HubProtocol;
  readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
    this.proto = new HubProtocol(transport);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
    // Two ping attempts — cold connects sometimes drop the first frame while
    // USB CDC state settles. Both failing is still non-fatal; caller can retry.
    for (let i = 0; i < 2; i++) {
      try {
        await this.proto.ping(3000);
        return;
      } catch {
        // fall through and retry
      }
    }
  }

  async disconnect(): Promise<void> {
    try { await this.proto.stop(3000); } catch { /* noop */ }
    this.proto.dispose();
    await this.transport.disconnect();
  }

  async run(code: string, opts: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
    const path = `/sd/${TMP_RUN_NAME}`;
    let stdout = "";
    const sink = (t: string) => {
      stdout += t;
      opts.onStdout?.(t);
    };
    this.proto.setStdoutSink(sink);
    try {
      const bytes = new TextEncoder().encode(code);
      await this.proto.upload(path, bytes, 3000);
      await this.proto.runProgram(path, opts.timeoutMs ?? 3000);
    } finally {
      this.proto.setStdoutSink(null);
    }
    return { stdout, stderr: "" };
  }

  async stop(): Promise<void> {
    await this.proto.stop();
  }

  async readFile(path: string, opts: { timeoutMs?: number } = {}): Promise<string> {
    const bytes = await this.proto.readFile(path, opts.timeoutMs ?? 3000);
    return new TextDecoder().decode(bytes);
  }

  async upload(path: string, bytes: Uint8Array, opts: UploadRunOptions): Promise<UploadResult> {
    validatePath(path, opts.policy);
    const sink = opts.onStdout ? (t: string) => opts.onStdout!(t) : null;
    this.proto.setStdoutSink(sink);
    try {
      await this.proto.upload(path, bytes, 3000);
      opts.onProgress?.(bytes.length, bytes.length);
      if (opts.autoRun) {
        await this.proto.runProgram(path);
      }
    } finally {
      this.proto.setStdoutSink(null);
    }
    return { path, length: bytes.length };
  }
}

/** Path web app uses for Run-button uploads. Exposed so UI can display it. */
export function runButtonPath(projectTitle: string, allowRoot: boolean): string {
  const base = sanitizeFilename(projectTitle);
  return (allowRoot ? "/" : "/sd/") + base + ".py";
}
