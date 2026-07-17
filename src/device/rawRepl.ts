import type { Transport, Unsubscribe } from "../transport/types";

const CTRL_A = 0x01;
const CTRL_B = 0x02;
const CTRL_C = 0x03;
const CTRL_D = 0x04;
const CTRL_E = 0x05;

const RAW_BANNER = "raw REPL; CTRL-B to exit\r\n>";

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export type StdoutListener = (chunk: string) => void;

/**
 * Raw-paste REPL client. Mirrors MicroPython pyboard.py:raw_paste_write.
 * Transport-agnostic — same code path over BLE NUS or USB CDC.
 */
export class RawRepl {
  private rxBuf: Uint8Array = new Uint8Array(0);
  private unsub: Unsubscribe | null = null;
  private text = new TextDecoder();
  private enc = new TextEncoder();
  private bootstrapped = false;
  /** Waiters for specific byte-pattern conditions on rxBuf. */
  private waiters: Array<{ test: (buf: Uint8Array) => number; resolve: (drained: Uint8Array) => void; reject: (e: Error) => void; timer?: ReturnType<typeof setTimeout> }> = [];

  private transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
    this.unsub = transport.onData((chunk) => this.onChunk(chunk));
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    for (const w of this.waiters) {
      if (w.timer) clearTimeout(w.timer);
      w.reject(new Error("Disposed"));
    }
    this.waiters = [];
  }

  /** Kill any running program and re-enter raw REPL. */
  async enterRawRepl(): Promise<void> {
    await this.transport.write(new Uint8Array([0x0d, CTRL_C, CTRL_C]));
    // small settle
    await this.drainFor(50);
    this.rxBuf = new Uint8Array(0);
    await this.transport.write(new Uint8Array([0x0d, CTRL_A]));
    await this.waitFor(RAW_BANNER, 3000);
    this.bootstrapped = true;
  }

  /** Return to friendly REPL. */
  async exitRawRepl(): Promise<void> {
    if (!this.bootstrapped) return;
    await this.transport.write(new Uint8Array([CTRL_B]));
    this.bootstrapped = false;
  }

  /** Send Ctrl-C twice to abort a running program. */
  async interrupt(): Promise<void> {
    await this.transport.write(new Uint8Array([CTRL_C, CTRL_C]));
  }

  /**
   * Execute Python source via raw-paste. Optional stdout streaming callback
   * receives decoded text chunks as the device produces them.
   *
   * If `extraStdinBytes` is provided, they are streamed after the code's
   * closing \x04 — used by fileTransfer to push raw file bytes into
   * sys.stdin.buffer.read() on the device.
   */
  async exec(source: string, opts: { onStdout?: StdoutListener; extraStdinBytes?: Uint8Array; timeoutMs?: number } = {}): Promise<ExecResult> {
    if (!this.bootstrapped) await this.enterRawRepl();
    // Request raw-paste
    await this.transport.write(new Uint8Array([CTRL_E, 0x41, CTRL_A]));
    // Expect: 'R', 0x01, <win-lo>, <win-hi>
    const header = await this.readExact(4, 3000);
    if (header[0] !== 0x52) {
      throw new Error(`raw-paste bad header (got 0x${header[0].toString(16)})`);
    }
    if (header[1] !== 0x01) {
      throw new Error("raw-paste not supported by device (R\\x00)");
    }
    const windowSize = header[2] | (header[3] << 8);
    let window = windowSize;
    const codeBytes = this.enc.encode(source);
    // Stream code respecting window flow control.
    let offset = 0;
    while (offset < codeBytes.length) {
      while (window <= 0) {
        const b = await this.readOne(5000);
        if (b === 0x01) window += windowSize;
        else if (b === 0x04) throw new Error("device aborted paste");
      }
      const send = Math.min(window, codeBytes.length - offset, 256);
      await this.transport.write(codeBytes.subarray(offset, offset + send));
      offset += send;
      window -= send;
    }
    // End of code.
    await this.transport.write(new Uint8Array([CTRL_D]));
    // Device ACKs with \x04, then streams stdout, then \x04 + err + \x04>
    const ack = await this.readOne(5000);
    if (ack !== CTRL_D) throw new Error(`missing paste ack (got 0x${ack.toString(16)})`);
    // If caller wants to push stdin bytes to the running program, do it now.
    if (opts.extraStdinBytes && opts.extraStdinBytes.length > 0) {
      await this.transport.write(opts.extraStdinBytes);
    }
    // Stream stdout until we see \x04 (start of tail frame).
    const stdout: number[] = [];
    const timeoutMs = opts.timeoutMs ?? 30000;
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (Date.now() > deadline) throw new Error("exec timeout");
      const b = await this.readOne(deadline - Date.now());
      if (b === CTRL_D) break;
      stdout.push(b);
      if (opts.onStdout) opts.onStdout(this.text.decode(new Uint8Array([b]), { stream: true }));
    }
    // Read stderr until next \x04.
    const stderr: number[] = [];
    while (true) {
      const b = await this.readOne(5000);
      if (b === CTRL_D) break;
      stderr.push(b);
    }
    // Trailing '>' to indicate raw REPL prompt back.
    const prompt = await this.readOne(5000);
    if (prompt !== 0x3e) {
      // Not fatal; some firmwares vary. Continue.
    }
    return {
      stdout: this.text.decode(new Uint8Array(stdout)),
      stderr: this.text.decode(new Uint8Array(stderr)),
    };
  }

  private onChunk(chunk: Uint8Array): void {
    const merged = new Uint8Array(this.rxBuf.length + chunk.length);
    merged.set(this.rxBuf, 0);
    merged.set(chunk, this.rxBuf.length);
    this.rxBuf = merged;
    // Wake waiters.
    for (let i = 0; i < this.waiters.length; ) {
      const w = this.waiters[i];
      const n = w.test(this.rxBuf);
      if (n > 0) {
        const drained = this.rxBuf.subarray(0, n);
        this.rxBuf = this.rxBuf.subarray(n);
        if (w.timer) clearTimeout(w.timer);
        this.waiters.splice(i, 1);
        w.resolve(new Uint8Array(drained));
      } else {
        i++;
      }
    }
  }

  private waitCondition(test: (buf: Uint8Array) => number, timeoutMs: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      // Immediate check.
      const n = test(this.rxBuf);
      if (n > 0) {
        const drained = this.rxBuf.subarray(0, n);
        this.rxBuf = this.rxBuf.subarray(n);
        resolve(new Uint8Array(drained));
        return;
      }
      const w = { test, resolve, reject } as (typeof this.waiters)[number];
      w.timer = setTimeout(() => {
        const idx = this.waiters.indexOf(w);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error("waitCondition timeout"));
      }, timeoutMs);
      this.waiters.push(w);
    });
  }

  private waitFor(needle: string, timeoutMs: number): Promise<Uint8Array> {
    const needleBytes = this.enc.encode(needle);
    return this.waitCondition((buf) => {
      const idx = indexOfSub(buf, needleBytes);
      return idx >= 0 ? idx + needleBytes.length : 0;
    }, timeoutMs);
  }

  private readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    return this.waitCondition((buf) => (buf.length >= n ? n : 0), timeoutMs);
  }

  private async readOne(timeoutMs: number): Promise<number> {
    const bytes = await this.readExact(1, timeoutMs);
    return bytes[0];
  }

  private drainFor(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

function indexOfSub(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
