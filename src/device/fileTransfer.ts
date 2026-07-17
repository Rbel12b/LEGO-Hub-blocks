import type { RawRepl } from "./rawRepl";

const FORBIDDEN = new Set(["/main.py", "/boot.py", "/boot.mpy"]);

export class UploadError extends Error {}

export interface UploadPolicy {
  allowRoot: boolean;
}

/** Client-side path allowlist. Snippet re-checks server-side. */
export function validatePath(path: string, policy: UploadPolicy): void {
  if (FORBIDDEN.has(path)) throw new UploadError(`Forbidden path: ${path}`);
  if (path.startsWith("/sd/")) return;
  if (policy.allowRoot && path.startsWith("/") && !path.startsWith("//")) return;
  throw new UploadError(`Path must be under /sd/ (allowRoot=${policy.allowRoot}): ${path}`);
}

export function buildUploadSnippet(path: string, length: number): string {
  return [
    `import sys, os`,
    `_p = ${JSON.stringify(path)}`,
    `if _p in ("/main.py", "/boot.py", "/boot.mpy"):`,
    `    raise ValueError("forbidden path")`,
    `_d = _p.rsplit("/", 1)[0] or "/"`,
    `if _d and _d != "/":`,
    `    _acc = ""`,
    `    for _part in _d.strip("/").split("/"):`,
    `        _acc += "/" + _part`,
    `        try:`,
    `            os.stat(_acc)`,
    `        except OSError:`,
    `            try:`,
    `                os.mkdir(_acc)`,
    `            except OSError as _e:`,
    `                raise OSError("cannot create dir " + _acc + ": " + str(_e))`,
    `_l = ${length}`,
    `_b = bytearray()`,
    `while len(_b) < _l:`,
    `    _b += sys.stdin.buffer.read(min(64, _l - len(_b)))`,
    `with open(_p, "wb") as f:`,
    `    f.write(_b)`,
    `print("OK", _p, _l)`,
    ``,
  ].join("\n");
}

export interface UploadResult {
  path: string;
  length: number;
}

export interface UploadOptions {
  policy: UploadPolicy;
  onProgress?: (sent: number, total: number) => void;
  timeoutMs?: number;
}

export async function uploadFile(
  repl: RawRepl,
  path: string,
  bytes: Uint8Array,
  opts: UploadOptions,
): Promise<UploadResult> {
  validatePath(path, opts.policy);
  const snippet = buildUploadSnippet(path, bytes.length);
  const result = await repl.exec(snippet, {
    extraStdinBytes: bytes,
    timeoutMs: opts.timeoutMs ?? 60000,
    onStdout: opts.onProgress
      ? () => {
          // Device prints "OK <path> <len>" only at completion — no incremental
          // progress from device. Fire final tick to signal done.
          opts.onProgress?.(bytes.length, bytes.length);
        }
      : undefined,
  });
  if (result.stderr) throw new UploadError(result.stderr.trim());
  const expected = `OK ${path} ${bytes.length}`;
  if (!result.stdout.includes(expected)) {
    throw new UploadError(`Unexpected reply: ${result.stdout.trim()}`);
  }
  return { path, length: bytes.length };
}

export function autoRunSnippet(path: string): string {
  return `exec(open(${JSON.stringify(path)}).read())\n`;
}
