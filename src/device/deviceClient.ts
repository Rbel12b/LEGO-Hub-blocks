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
 * High-level device operations. Every user action (run/upload) first re-enters
 * raw REPL — which sends Ctrl-C x2 killing whatever is running (typically the
 * device's main.py LVGL menu). When the action finishes, softReset restarts
 * the device so main.py runs again.
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
    // Enter raw REPL now to interrupt any running main.py so subsequent actions
    // start from a clean state.
    await this.repl.enterRawRepl();
    // Return control to main.py right away — user hasn't asked for anything yet.
    await this.repl.softReset();
  }

  async disconnect(): Promise<void> {
    // Leave device running main.py after disconnect. If we're still bootstrapped,
    // soft-reset so the device resumes its idle menu.
    try { await this.repl.softReset(); } catch { /* noop */ }
    try { await this.repl.exitRawRepl(); } catch { /* noop */ }
    this.repl.dispose();
    await this.transport.disconnect();
  }

  async run(code: string, opts: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
    // enterRawRepl kills main.py (Ctrl-C x2) and re-enters raw mode.
    await this.repl.enterRawRepl();
    try {
      return await this.repl.exec(code, { onStdout: opts.onStdout, timeoutMs: opts.timeoutMs });
    } finally {
      // Program has finished (or was stopped). Restart main.py.
      await this.repl.softReset();
    }
  }

  async stop(): Promise<void> {
    // Ctrl-C x2 raises KeyboardInterrupt in the running program. The pending
    // run() will unblock, complete its tail frame, then softReset in its finally.
    await this.repl.interrupt();
  }

  async upload(path: string, bytes: Uint8Array, opts: UploadRunOptions): Promise<UploadResult> {
    await this.repl.enterRawRepl();
    try {
      const result = await uploadFile(this.repl, path, bytes, {
        policy: opts.policy,
        onProgress: opts.onProgress,
      });
      if (opts.autoRun) {
        const run = await this.repl.exec(autoRunSnippet(path), { onStdout: opts.onStdout });
        if (run.stderr) throw new Error(run.stderr.trim());
      }
      return result;
    } finally {
      await this.repl.softReset();
    }
  }
}
