import type { DataListener, Transport, TransportInfo, Unsubscribe } from "./types";

/**
 * In-memory MicroPython device mock. Implements just enough of the raw-paste
 * REPL to exercise deviceClient / fileTransfer / rawRepl code paths.
 *
 * State machine:
 *   IDLE          waiting for Ctrl-A (0x01) to enter raw REPL
 *   RAW_REPL      raw REPL prompt shown; waiting for \x05A\x01 to request raw-paste
 *   RAW_PASTE     accepting code bytes; \x04 ends the code, triggers execution
 */
type State = "IDLE" | "RAW_REPL" | "RAW_PASTE";

const RAW_BANNER = new TextEncoder().encode("raw REPL; CTRL-B to exit\r\n>");
const WINDOW = 4096;

export interface MockOptions {
  /** Optional stdout to return for the next executed program (test seam). */
  stdout?: string;
  /** Files pre-populated in the virtual FS. */
  files?: Record<string, Uint8Array>;
  /** Emit \x04MTU=<n>\n banner on connect (mimics BLE firmware). */
  emitMtuBanner?: number;
}

export class MockTransport implements Transport {
  readonly kind = "mock" as const;
  readonly info: TransportInfo;
  private _connected = false;
  private dataCbs = new Set<DataListener>();
  private discCbs = new Set<() => void>();
  private state: State = "IDLE";
  private buf: number[] = [];
  private codeBuf: number[] = [];
  public files: Record<string, Uint8Array>;
  private nextStdout: string;

  private opts: MockOptions;

  constructor(opts: MockOptions = {}) {
    this.opts = opts;
    this.files = { ...(opts.files ?? {}) };
    this.nextStdout = opts.stdout ?? "";
    this.info = { name: "MockDevice", mtu: opts.emitMtuBanner };
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    this._connected = true;
    if (this.opts.emitMtuBanner) {
      const banner = new TextEncoder().encode(`\x04MTU=${this.opts.emitMtuBanner}\n`);
      queueMicrotask(() => this.emit(banner));
    }
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    for (const cb of this.discCbs) cb();
  }

  onData(cb: DataListener): Unsubscribe {
    this.dataCbs.add(cb);
    return () => this.dataCbs.delete(cb);
  }

  onDisconnect(cb: () => void): Unsubscribe {
    this.discCbs.add(cb);
    return () => this.discCbs.delete(cb);
  }

  /** Set the stdout that the next executed program will return. */
  setNextStdout(s: string): void {
    this.nextStdout = s;
  }

  async write(chunk: Uint8Array): Promise<void> {
    if (!this._connected) throw new Error("Not connected");
    for (const b of chunk) this.buf.push(b);
    this.process();
  }

  private emit(bytes: Uint8Array) {
    for (const cb of this.dataCbs) cb(bytes);
  }

  private consume(n: number): Uint8Array {
    return new Uint8Array(this.buf.splice(0, n));
  }

  private process(): void {
    while (this.buf.length > 0) {
      if (this.state === "IDLE") {
        const b = this.buf[0];
        if (b === 0x01) {
          this.buf.shift();
          this.state = "RAW_REPL";
          queueMicrotask(() => this.emit(RAW_BANNER));
        } else if (b === 0x02) {
          this.buf.shift();
        } else {
          this.buf.shift();
        }
      } else if (this.state === "RAW_REPL") {
        const b0 = this.buf[0];
        // Ctrl-A while already in raw REPL: re-print banner (matches MicroPython).
        if (b0 === 0x01) {
          this.buf.shift();
          queueMicrotask(() => this.emit(RAW_BANNER));
          continue;
        }
        // Ctrl-B: back to friendly REPL.
        if (b0 === 0x02) {
          this.buf.shift();
          this.state = "IDLE";
          continue;
        }
        // Ctrl-C: no-op at raw REPL prompt.
        if (b0 === 0x03) {
          this.buf.shift();
          continue;
        }
        // Ctrl-D: soft-reboot request. Simulate reboot by dropping to IDLE.
        if (b0 === 0x04) {
          this.buf.shift();
          this.state = "IDLE";
          continue;
        }
        // Raw-paste request \x05A\x01.
        if (this.buf.length < 3) return;
        if (b0 === 0x05 && this.buf[1] === 0x41 && this.buf[2] === 0x01) {
          this.consume(3);
          this.state = "RAW_PASTE";
          const win = new Uint8Array([0x52, 0x01, WINDOW & 0xff, (WINDOW >> 8) & 0xff]);
          queueMicrotask(() => this.emit(win));
        } else {
          this.buf.shift();
        }
      } else if (this.state === "RAW_PASTE") {
        // Buffer code until \x04.
        while (this.buf.length > 0) {
          const b = this.buf.shift()!;
          if (b === 0x04) {
            this.runProgram();
            return;
          }
          this.codeBuf.push(b);
        }
        return;
      }
    }
  }

  private runProgram(): void {
    const source = new TextDecoder().decode(new Uint8Array(this.codeBuf));
    this.codeBuf = [];
    let out = "";
    let err = "";
    try {
      out = this.executeSnippet(source);
    } catch (e) {
      err = (e as Error).message + "\n";
    }
    // ACK code accepted, then stream stdout, then tail frame.
    const enc = new TextEncoder();
    const ack = new Uint8Array([0x04]);
    const stdout = enc.encode(out);
    const tail = new Uint8Array([0x04, ...enc.encode(err), 0x04, 0x3e]);
    queueMicrotask(() => {
      this.emit(ack);
      if (stdout.length) this.emit(stdout);
      this.emit(tail);
    });
    // Return to raw-REPL prompt for the next raw-paste request.
    this.state = "RAW_REPL";
  }

  /**
   * Tiny "executor" for the exact snippets our fileTransfer / auto-run emits.
   * Not a real Python interpreter — pattern-matches known shapes.
   */
  private executeSnippet(source: string): string {
    // File write snippet: match _p="..."; _l=NNN; ... sys.stdin.buffer.read(...)
    const writeRe = /_p\s*=\s*"([^"]+)"[\s\S]*_l\s*=\s*(\d+)/;
    const m = writeRe.exec(source);
    if (m) {
      const path = m[1];
      const length = parseInt(m[2], 10);
      if (path === "/main.py" || path === "/boot.py" || path === "/boot.mpy") {
        throw new Error(`ValueError: forbidden path`);
      }
      // Bytes follow after the code's \x04 sentinel — but MockTransport treats
      // the payload as part of the next raw-paste session for simplicity. Tests
      // that need to verify the bytes should use fileTransfer's higher-level
      // path (which asserts device-side "OK <path> <len>" reply).
      this.files[path] = new Uint8Array(length);
      return `OK ${path} ${length}\n`;
    }
    // exec(open(...).read()) — return the pre-seeded next stdout.
    const execRe = /exec\(open\("([^"]+)"\)\.read\(\)\)/;
    if (execRe.exec(source)) {
      const s = this.nextStdout;
      this.nextStdout = "";
      return s;
    }
    // Otherwise pretend it ran and return the seeded stdout (if any).
    const s = this.nextStdout;
    this.nextStdout = "";
    return s;
  }
}
