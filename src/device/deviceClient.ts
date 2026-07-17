import type { Transport } from "../transport/types";
import { RawRepl } from "./rawRepl";
import { autoRunSnippet, uploadFile, type UploadPolicy, type UploadResult } from "./fileTransfer";

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

/**
 * High-level device operations. Wraps RawRepl + fileTransfer, hides the
 * enter-raw-repl bootstrap, and centralizes stop-on-disconnect logic.
 */
export class DeviceClient {
  private repl: RawRepl;

  readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
    this.repl = new RawRepl(transport);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
    await this.repl.enterRawRepl();
  }

  async disconnect(): Promise<void> {
    try { await this.repl.exitRawRepl(); } catch { /* noop */ }
    this.repl.dispose();
    await this.transport.disconnect();
  }

  async run(code: string, opts: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
    return this.repl.exec(code, { onStdout: opts.onStdout, timeoutMs: opts.timeoutMs });
  }

  async stop(): Promise<void> {
    await this.repl.interrupt();
  }

  async upload(path: string, bytes: Uint8Array, opts: UploadRunOptions): Promise<UploadResult> {
    const result = await uploadFile(this.repl, path, bytes, {
      policy: opts.policy,
      onProgress: opts.onProgress,
    });
    if (opts.autoRun) {
      const run = await this.repl.exec(autoRunSnippet(path), { onStdout: opts.onStdout });
      if (run.stderr) throw new Error(run.stderr.trim());
    }
    return result;
  }
}
