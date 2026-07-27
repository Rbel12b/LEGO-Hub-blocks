import type { Transport, Unsubscribe } from "../transport/types";

/**
 * Hub wire protocol. Replaces raw MicroPython REPL entirely for run/upload/stop.
 *
 * Frame delimiter: 0x1E (ASCII Record Separator).
 *
 * Web → Device:
 *   \x1eRUN <path>\n                       - launch runner.run_program(path)
 *   \x1eUPLOAD <path> <len>\n<len bytes>  - write file
 *   \x1eSTOP\n                             - request stop (runner exits between loop iters)
 *   \x1eREAD <path>\n                      - read file, reply DATA
 *   \x1ePING\n                             - health check
 *
 * Device → Web:
 *   \x1eOK <msg>\n                         - control success
 *   \x1eERR <msg>\n                        - control error
 *   \x1eDATA <len>\n<len bytes>            - binary payload (READ)
 *   any other bytes                        - stdout, streamed to user
 *
 * Encoding: header line is UTF-8; payload after DATA/UPLOAD header is raw bytes
 * of exact declared length (no escaping).
 */

const RS = 0x1e;

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

export type StdoutSink = (chunk: string) => void;

interface Waiter {
  resolve: (reply: FrameReply) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export interface FrameReply {
  kind: "OK" | "ERR" | "DATA";
  message: string;
  data?: Uint8Array;
}

interface ParseState {
  /** null = scanning stdout; else = collected header bytes after RS (excluding RS itself) */
  headerBuf: number[] | null;
  /** if reading DATA payload, bytes remaining */
  dataRemaining: number;
  dataKind: "DATA" | null;
  dataMessage: string;
  dataBuf: Uint8Array | null;
  dataOffset: number;
}

export class HubProtocol {
  private transport: Transport;
  private unsub: Unsubscribe | null = null;
  private onStdout: StdoutSink | null = null;
  private waiters: Waiter[] = [];
  private state: ParseState = {
    headerBuf: null,
    dataRemaining: 0,
    dataKind: null,
    dataMessage: "",
    dataBuf: null,
    dataOffset: 0,
  };
  private sending = Promise.resolve();

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

  setStdoutSink(sink: StdoutSink | null): void {
    this.onStdout = sink;
  }

  async ping(timeoutMs = 3000): Promise<void> {
    const reply = await this.send(enc.encode("\x1ePING\n"), timeoutMs);
    if (reply.kind !== "OK") throw new Error(reply.message || "PING failed");
  }

  async runProgram(path: string, timeoutMs = 5000): Promise<void> {
    const reply = await this.send(enc.encode(`\x1eRUN ${path}\n`), timeoutMs);
    if (reply.kind !== "OK") throw new Error(reply.message || "RUN failed");
  }

  async stop(timeoutMs = 3000): Promise<void> {
    const reply = await this.send(enc.encode("\x1eSTOP\n"), timeoutMs);
    if (reply.kind !== "OK") throw new Error(reply.message || "STOP failed");
  }

  async upload(path: string, bytes: Uint8Array, timeoutMs = 60000): Promise<void> {
    const header = enc.encode(`\x1eUPLOAD ${path} ${bytes.length}\n`);
    const frame = new Uint8Array(header.length + bytes.length);
    frame.set(header, 0);
    frame.set(bytes, header.length);
    const reply = await this.send(frame, timeoutMs);
    if (reply.kind !== "OK") throw new Error(reply.message || "UPLOAD failed");
  }

  async readFile(path: string, timeoutMs = 15000): Promise<Uint8Array> {
    const reply = await this.send(enc.encode(`\x1eREAD ${path}\n`), timeoutMs);
    if (reply.kind === "ERR") throw new Error(reply.message);
    if (reply.kind !== "DATA" || !reply.data) throw new Error("READ: expected DATA reply");
    return reply.data;
  }

  private send(frame: Uint8Array, timeoutMs: number): Promise<FrameReply> {
    const p = new Promise<FrameReply>((resolve, reject) => {
      const w: Waiter = { resolve, reject };
      w.timer = setTimeout(() => {
        const idx = this.waiters.indexOf(w);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error("protocol timeout"));
      }, timeoutMs);
      this.waiters.push(w);
    });
    this.sending = this.sending.then(() => this.transport.write(frame)).catch(() => { /* noop */ });
    return p;
  }

  private resolveNext(reply: FrameReply): void {
    const w = this.waiters.shift();
    if (!w) return;
    if (w.timer) clearTimeout(w.timer);
    w.resolve(reply);
  }

  private onChunk(chunk: Uint8Array): void {
    let i = 0;
    while (i < chunk.length) {
      if (this.state.dataBuf) {
        const need = this.state.dataRemaining;
        const take = Math.min(need, chunk.length - i);
        this.state.dataBuf.set(chunk.subarray(i, i + take), this.state.dataOffset);
        this.state.dataOffset += take;
        this.state.dataRemaining -= take;
        i += take;
        if (this.state.dataRemaining === 0) {
          const buf = this.state.dataBuf;
          const msg = this.state.dataMessage;
          this.state.dataBuf = null;
          this.state.dataOffset = 0;
          this.state.dataMessage = "";
          this.state.dataKind = null;
          this.resolveNext({ kind: "DATA", message: msg, data: buf });
        }
        continue;
      }
      if (this.state.headerBuf !== null) {
        const b = chunk[i++];
        if (b === 0x0a) {
          const line = new Uint8Array(this.state.headerBuf);
          this.state.headerBuf = null;
          this.handleHeader(dec.decode(line));
        } else {
          this.state.headerBuf.push(b);
        }
        continue;
      }
      const b = chunk[i];
      if (b === RS) {
        this.state.headerBuf = [];
        i++;
      } else {
        // stdout run — accumulate until next RS.
        let j = i;
        while (j < chunk.length && chunk[j] !== RS) j++;
        if (this.onStdout) this.onStdout(dec.decode(chunk.subarray(i, j)));
        i = j;
      }
    }
  }

  private handleHeader(header: string): void {
    // header format: "<KIND> <message>" or "DATA <len>"
    const spaceIdx = header.indexOf(" ");
    const kind = spaceIdx >= 0 ? header.slice(0, spaceIdx) : header;
    const rest = spaceIdx >= 0 ? header.slice(spaceIdx + 1) : "";
    if (kind === "OK") {
      this.resolveNext({ kind: "OK", message: rest });
    } else if (kind === "ERR") {
      this.resolveNext({ kind: "ERR", message: rest });
    } else if (kind === "DATA") {
      const spIdx = rest.indexOf(" ");
      const lenStr = spIdx >= 0 ? rest.slice(0, spIdx) : rest;
      const msg = spIdx >= 0 ? rest.slice(spIdx + 1) : "";
      const len = parseInt(lenStr, 10);
      if (Number.isNaN(len) || len < 0) {
        this.resolveNext({ kind: "ERR", message: "bad DATA header" });
        return;
      }
      if (len === 0) {
        this.resolveNext({ kind: "DATA", message: msg, data: new Uint8Array(0) });
        return;
      }
      this.state.dataBuf = new Uint8Array(len);
      this.state.dataRemaining = len;
      this.state.dataOffset = 0;
      this.state.dataMessage = msg;
      this.state.dataKind = "DATA";
    } else {
      // Unknown frame — drop, don't resolve.
    }
  }
}

const FORBIDDEN = new Set(["/main.py", "/boot.py", "/boot.mpy", "/runner.py"]);

export class UploadError extends Error {}

export interface UploadPolicy {
  allowRoot: boolean;
}

export function validatePath(path: string, policy: UploadPolicy): void {
  if (FORBIDDEN.has(path)) throw new UploadError(`Forbidden path: ${path}`);
  if (path.startsWith("/sd/")) return;
  if (policy.allowRoot && path.startsWith("/") && !path.startsWith("//")) return;
  throw new UploadError(`Path must be under /sd/ (allowRoot=${policy.allowRoot}): ${path}`);
}
