import type { DataListener, Transport, TransportInfo, Unsubscribe } from "./types";

/**
 * In-memory mock hub speaking the new HubProtocol frame format
 * (0x1E-delimited). Understands RUN / UPLOAD / STOP / READ / PING and echoes
 * OK/ERR/DATA replies. Programs are not actually executed — the mock replies
 * OK to RUN and streams a pre-seeded stdout (see setNextStdout) before OK.
 */
const RS = 0x1e;

export interface MockOptions {
  stdout?: string;
  files?: Record<string, Uint8Array>;
}

interface PendingUpload {
  path: string;
  remaining: number;
  buf: Uint8Array;
  offset: number;
}

export class MockTransport implements Transport {
  readonly kind = "mock" as const;
  readonly info: TransportInfo;
  private _connected = false;
  private dataCbs = new Set<DataListener>();
  private discCbs = new Set<() => void>();
  private headerBuf: number[] | null = null;
  private pendingUpload: PendingUpload | null = null;
  public files: Record<string, Uint8Array>;
  private nextStdout: string;

  constructor(opts: MockOptions = {}) {
    this.files = { ...(opts.files ?? {}) };
    this.nextStdout = opts.stdout ?? "";
    this.info = { name: "MockDevice" };
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    this._connected = true;
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

  setNextStdout(s: string): void {
    this.nextStdout = s;
  }

  async write(chunk: Uint8Array): Promise<void> {
    if (!this._connected) throw new Error("Not connected");
    let i = 0;
    while (i < chunk.length) {
      if (this.pendingUpload) {
        const take = Math.min(this.pendingUpload.remaining, chunk.length - i);
        this.pendingUpload.buf.set(chunk.subarray(i, i + take), this.pendingUpload.offset);
        this.pendingUpload.offset += take;
        this.pendingUpload.remaining -= take;
        i += take;
        if (this.pendingUpload.remaining === 0) {
          this.files[this.pendingUpload.path] = this.pendingUpload.buf;
          const path = this.pendingUpload.path;
          this.pendingUpload = null;
          this.replyOk(`UPLOAD ${path}`);
        }
        continue;
      }
      if (this.headerBuf !== null) {
        const b = chunk[i++];
        if (b === 0x0a) {
          const header = new TextDecoder().decode(new Uint8Array(this.headerBuf));
          this.headerBuf = null;
          this.handleHeader(header);
        } else {
          this.headerBuf.push(b);
        }
        continue;
      }
      if (chunk[i] === RS) {
        this.headerBuf = [];
        i++;
      } else {
        // Bytes outside a frame in web→device direction shouldn't happen; drop.
        i++;
      }
    }
  }

  private handleHeader(header: string): void {
    const sp = header.indexOf(" ");
    const cmd = sp >= 0 ? header.slice(0, sp) : header;
    const rest = sp >= 0 ? header.slice(sp + 1) : "";
    if (cmd === "PING") return this.replyOk("PING");
    if (cmd === "STOP") return this.replyOk("STOP");
    if (cmd === "RUN") {
      const path = rest;
      if (!this.files[path]) return this.replyErr(`no such file: ${path}`);
      if (this.nextStdout) {
        this.emitStdout(this.nextStdout);
        this.nextStdout = "";
      }
      return this.replyOk(`RUN ${path}`);
    }
    if (cmd === "READ") {
      const path = rest;
      const bytes = this.files[path];
      if (!bytes) return this.replyErr(`no such file: ${path}`);
      return this.replyData(bytes, path);
    }
    if (cmd === "UPLOAD") {
      const parts = rest.split(" ");
      if (parts.length < 2) return this.replyErr("UPLOAD: bad header");
      const path = parts.slice(0, -1).join(" ");
      const len = parseInt(parts[parts.length - 1], 10);
      if (Number.isNaN(len) || len < 0) return this.replyErr("UPLOAD: bad length");
      if (path === "/main.py" || path === "/boot.py" || path === "/boot.mpy" || path === "/runner.py") {
        return this.replyErr(`forbidden path: ${path}`);
      }
      if (len === 0) {
        this.files[path] = new Uint8Array(0);
        return this.replyOk(`UPLOAD ${path}`);
      }
      this.pendingUpload = { path, remaining: len, buf: new Uint8Array(len), offset: 0 };
      return;
    }
    return this.replyErr(`unknown command: ${cmd}`);
  }

  private emit(bytes: Uint8Array): void {
    for (const cb of this.dataCbs) cb(bytes);
  }

  private emitStdout(text: string): void {
    queueMicrotask(() => this.emit(new TextEncoder().encode(text)));
  }

  private replyOk(msg: string): void {
    const frame = new TextEncoder().encode(`\x1eOK ${msg}\n`);
    queueMicrotask(() => this.emit(frame));
  }

  private replyErr(msg: string): void {
    const frame = new TextEncoder().encode(`\x1eERR ${msg}\n`);
    queueMicrotask(() => this.emit(frame));
  }

  private replyData(bytes: Uint8Array, msg = ""): void {
    const header = new TextEncoder().encode(`\x1eDATA ${bytes.length}${msg ? " " + msg : ""}\n`);
    const frame = new Uint8Array(header.length + bytes.length);
    frame.set(header, 0);
    frame.set(bytes, header.length);
    queueMicrotask(() => this.emit(frame));
  }
}
