import { describe, expect, it } from "vitest";
import { buildUploadSnippet, validatePath, UploadError } from "../src/device/fileTransfer";

describe("fileTransfer.validatePath", () => {
  it("accepts /sd/ paths by default", () => {
    validatePath("/sd/prog.py", { allowRoot: false });
  });

  it("rejects root paths without allowRoot", () => {
    expect(() => validatePath("/prog.py", { allowRoot: false })).toThrow(UploadError);
  });

  it("accepts root paths when allowRoot enabled", () => {
    validatePath("/prog.py", { allowRoot: true });
  });

  it("always rejects /main.py, /boot.py, /boot.mpy", () => {
    for (const p of ["/main.py", "/boot.py", "/boot.mpy"]) {
      expect(() => validatePath(p, { allowRoot: true })).toThrow(/forbidden/i);
    }
  });
});

describe("fileTransfer.buildUploadSnippet", () => {
  it("embeds path and length and re-checks forbidden list server-side", () => {
    const s = buildUploadSnippet("/sd/x.py", 42);
    expect(s).toContain(`_p = "/sd/x.py"`);
    expect(s).toContain(`_l = 42`);
    expect(s).toContain(`"/main.py"`);
    expect(s).toContain(`"/boot.py"`);
    expect(s).toContain(`"/boot.mpy"`);
    expect(s).toContain(`sys.stdin.buffer.read`);
    expect(s).toContain(`print("OK", _p, _l)`);
  });

  it("escapes path with JSON.stringify", () => {
    const s = buildUploadSnippet('/sd/na"me.py', 1);
    expect(s).toContain(`_p = "/sd/na\\"me.py"`);
  });
});
