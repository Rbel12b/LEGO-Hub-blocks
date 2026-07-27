import { describe, expect, it } from "vitest";
import { validatePath, UploadError, HubProtocol } from "../src/device/protocol";
import { MockTransport } from "../src/transport/mock";

describe("protocol.validatePath", () => {
  it("accepts /sd/ paths by default", () => {
    validatePath("/sd/prog.py", { allowRoot: false });
  });

  it("rejects root paths without allowRoot", () => {
    expect(() => validatePath("/prog.py", { allowRoot: false })).toThrow(UploadError);
  });

  it("accepts root paths when allowRoot enabled", () => {
    validatePath("/prog.py", { allowRoot: true });
  });

  it("always rejects /main.py, /boot.py, /boot.mpy, /runner.py", () => {
    for (const p of ["/main.py", "/boot.py", "/boot.mpy", "/runner.py"]) {
      expect(() => validatePath(p, { allowRoot: true })).toThrow(/forbidden/i);
    }
  });
});

describe("HubProtocol frame IO", () => {
  it("PING → OK", async () => {
    const transport = new MockTransport();
    await transport.connect();
    const proto = new HubProtocol(transport);
    await expect(proto.ping()).resolves.toBeUndefined();
    proto.dispose();
    await transport.disconnect();
  });

  it("UPLOAD + READ roundtrip", async () => {
    const transport = new MockTransport();
    await transport.connect();
    const proto = new HubProtocol(transport);
    const bytes = new TextEncoder().encode("print('hi')\n");
    await proto.upload("/sd/x.py", bytes);
    const back = await proto.readFile("/sd/x.py");
    expect(new TextDecoder().decode(back)).toBe("print('hi')\n");
    proto.dispose();
    await transport.disconnect();
  });

  it("RUN streams stdout then OK", async () => {
    const transport = new MockTransport({ files: { "/sd/y.py": new Uint8Array([1]) }, stdout: "hello\n" });
    await transport.connect();
    const proto = new HubProtocol(transport);
    let out = "";
    proto.setStdoutSink((t) => { out += t; });
    await proto.runProgram("/sd/y.py");
    expect(out).toBe("hello\n");
    proto.dispose();
    await transport.disconnect();
  });
});
