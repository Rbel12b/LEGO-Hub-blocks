// Vite bundles every stub file under `./files/**` as a raw string at build
// time. The worker mounts these into pyright's virtual filesystem under
// /stubs/<path>. Keys are POSIX paths relative to /stubs.
const raw = import.meta.glob("./files/**/*", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

export const STUBS: Record<string, string> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k.replace(/^\.\/files\//, ""), v]),
);

export const STUB_ROOT = "/stubs";
