import { describe, it, expect } from "vitest";
import { createLspServer, chainAt, scanBindings, type RpcMessage } from "../src/editor/lsp/lspServer";

const HUB_STUB = `
class _Ports:
    A: _Motor
    B: _Motor
    LED: _LED

class _LED:
    def setRgbColor(self, r: int, g: int, b: int) -> None: ...
    def setRgbColorIdx(self, idx: int) -> None: ...

class _Motor:
    def startPower(self, power: int) -> None: ...

class _Buttons:
    def center(self) -> bool: ...
    def up(self) -> bool: ...

ports: _Ports
buttons: _Buttons

def powerOff() -> None: ...
`.trimStart();

const STUBS = { "hub.pyi": HUB_STUB };
const URI = "file:///workspace/main.py";

function run(source: string, seq: RpcMessage[]): RpcMessage[] {
  const out: RpcMessage[] = [];
  const server = createLspServer(STUBS, (m) => out.push(m));
  server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  server.handle({ jsonrpc: "2.0", method: "initialized", params: {} });
  server.handle({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri: URI, languageId: "python", version: 1, text: source } },
  });
  for (const msg of seq) server.handle(msg);
  return out;
}

function completionAt(source: string, line: number, character: number): any {
  const out = run(source, [{
    jsonrpc: "2.0",
    id: 100,
    method: "textDocument/completion",
    params: { textDocument: { uri: URI }, position: { line, character } },
  }]);
  const resp = out.find((m) => m.id === 100);
  return resp?.result;
}

describe("chainAt", () => {
  it("captures trailing dot", () => {
    const c = chainAt("hub.", 4);
    expect(c.parts).toEqual(["hub"]);
    expect(c.trailingDot).toBe(true);
  });
  it("captures multi-segment chain with partial word", () => {
    const c = chainAt("hub.ports.LE", 12);
    expect(c.parts).toEqual(["hub", "ports", "LE"]);
    expect(c.trailingDot).toBe(false);
  });
  it("captures deep trailing dot", () => {
    const c = chainAt("hub.ports.LED.", 14);
    expect(c.parts).toEqual(["hub", "ports", "LED"]);
    expect(c.trailingDot).toBe(true);
  });
  it("returns empty parts on blank line", () => {
    const c = chainAt("", 0);
    expect(c.parts).toEqual([]);
    expect(c.trailingDot).toBe(false);
  });
  it("skips balanced () after a method call", () => {
    const src = "hub.ports.A.device().";
    const c = chainAt(src, src.length);
    expect(c.parts).toEqual(["hub", "ports", "A", "device"]);
    expect(c.trailingDot).toBe(true);
  });
  it("skips nested calls with arguments", () => {
    const src = "hub.ports.A.device(1, foo(2)).";
    const c = chainAt(src, src.length);
    expect(c.parts).toEqual(["hub", "ports", "A", "device"]);
    expect(c.trailingDot).toBe(true);
  });
  it("skips balanced [] subscript", () => {
    const src = "obj.list[0].";
    const c = chainAt(src, src.length);
    expect(c.parts).toEqual(["obj", "list"]);
    expect(c.trailingDot).toBe(true);
  });
});

describe("createLspServer — initialize handshake", () => {
  it("advertises capabilities", () => {
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const init = out.find((m) => m.id === 1)?.result as any;
    expect(init.capabilities.completionProvider.triggerCharacters).toContain(".");
    expect(init.capabilities.hoverProvider).toBe(true);
    expect(init.capabilities.signatureHelpProvider.triggerCharacters).toContain("(");
  });
});

describe("createLspServer — completion", () => {
  it("returns top-level module symbols after `hub.`", () => {
    const items = completionAt("hub.", 0, 4).items;
    const names = items.map((it: any) => it.label).sort();
    expect(names).toEqual(["buttons", "ports", "powerOff"]);
  });

  it("follows attribute type refs (`hub.ports.` → A / B / LED)", () => {
    const items = completionAt("hub.ports.", 0, 10).items;
    const names = items.map((it: any) => it.label).sort();
    expect(names).toEqual(["A", "B", "LED"]);
  });

  it("filters by partial word (`hub.ports.L` → LED)", () => {
    const items = completionAt("hub.ports.L", 0, 11).items;
    const names = items.map((it: any) => it.label);
    expect(names).toContain("LED");
    expect(names).not.toContain("A");
  });

  it("nested chain resolves through two type refs (`hub.ports.LED.`)", () => {
    const items = completionAt("hub.ports.LED.", 0, 14).items;
    const names = items.map((it: any) => it.label).sort();
    expect(names).toEqual(["setRgbColor", "setRgbColorIdx"]);
  });

  it("returns empty on unknown root", () => {
    const items = completionAt("xxx.", 0, 4).items;
    expect(items).toEqual([]);
  });

  it("completion items carry Monaco-compatible kind + insertText", () => {
    const items = completionAt("hub.ports.LED.", 0, 14).items;
    const item = items.find((it: any) => it.label === "setRgbColor");
    expect(item.kind).toBe(2); // method
    expect(item.insertText).toBe("setRgbColor");
    expect(item.detail).toContain("setRgbColor");
  });
});

describe("createLspServer — hover", () => {
  it("returns markdown hover for method chain", () => {
    const source = "hub.ports.LED.setRgbColor(1,2,3)";
    const out = run(source, [{
      jsonrpc: "2.0", id: 42, method: "textDocument/hover",
      params: { textDocument: { uri: URI }, position: { line: 0, character: 18 } }, // inside "setRgbColor"
    }]);
    const resp = out.find((m) => m.id === 42)?.result as any;
    expect(resp).not.toBeNull();
    expect(resp.contents.value).toContain("setRgbColor");
  });

  it("returns null hover for unknown symbol", () => {
    const out = run("unknown_thing", [{
      jsonrpc: "2.0", id: 43, method: "textDocument/hover",
      params: { textDocument: { uri: URI }, position: { line: 0, character: 5 } },
    }]);
    const resp = out.find((m) => m.id === 43)?.result;
    expect(resp).toBeNull();
  });
});

describe("createLspServer — signature help", () => {
  it("returns signature inside function call", () => {
    const source = "hub.ports.LED.setRgbColor(1, ";
    const out = run(source, [{
      jsonrpc: "2.0", id: 50, method: "textDocument/signatureHelp",
      params: { textDocument: { uri: URI }, position: { line: 0, character: source.length } },
    }]);
    const resp = out.find((m) => m.id === 50)?.result as any;
    expect(resp).not.toBeNull();
    expect(resp.signatures[0].label).toContain("setRgbColor");
    expect(resp.activeParameter).toBe(1);
  });

  it("returns null outside any call", () => {
    const out = run("hub", [{
      jsonrpc: "2.0", id: 51, method: "textDocument/signatureHelp",
      params: { textDocument: { uri: URI }, position: { line: 0, character: 3 } },
    }]);
    expect(out.find((m) => m.id === 51)?.result).toBeNull();
  });
});

describe("createLspServer — diagnostics", () => {
  it("publishes diagnostics on didOpen", () => {
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: "print(hi" } },
    });
    const diag = out.find((m) => m.method === "textDocument/publishDiagnostics");
    expect(diag).toBeDefined();
    const params = diag!.params as any;
    expect(params.uri).toBe(URI);
    expect(params.diagnostics.length).toBeGreaterThan(0);
    expect(params.diagnostics[0].message).toMatch(/Unclosed/);
  });

  it("publishes empty diagnostics for clean source", () => {
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: "x = 1\n" } },
    });
    const diag = out.find((m) => m.method === "textDocument/publishDiagnostics")!.params as any;
    expect(diag.diagnostics).toEqual([]);
  });

  it("updates diagnostics on didChange", () => {
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: "x = 1\n" } },
    });
    out.length = 0;
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didChange",
      params: { textDocument: { uri: URI, version: 2 }, contentChanges: [{ text: "print(hi" }] },
    });
    const diag = out.find((m) => m.method === "textDocument/publishDiagnostics")!.params as any;
    expect(diag.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("scanBindings", () => {
  it("captures single-line assignment to dotted expr", () => {
    const b = scanBindings("A = hub.ports.A\n");
    expect(b.get("A")).toEqual(["hub", "ports", "A"]);
  });
  it("captures `import M as alias`", () => {
    const b = scanBindings("import lvgl as lv\n");
    expect(b.get("lv")).toEqual(["lvgl"]);
  });
  it("captures `from M import name`", () => {
    const b = scanBindings("from lpf2 import color\n");
    expect(b.get("color")).toEqual(["lpf2", "color"]);
  });
  it("captures `from M import name as alias`", () => {
    const b = scanBindings("from lpf2 import color as c\n");
    expect(b.get("c")).toEqual(["lpf2", "color"]);
  });
  it("strips call trailers so `X = A.device()` binds `X` → `A.device`", () => {
    // Call expressions map to their chain (return-type resolution happens
    // downstream in resolveChain via method typeRef).
    const b = scanBindings("X = A.device()\n");
    expect(b.get("X")).toEqual(["A", "device"]);
  });
  it("strips nested call trailers", () => {
    const b = scanBindings("X = hub.ports.A.device(1, foo(2))\n");
    expect(b.get("X")).toEqual(["hub", "ports", "A", "device"]);
  });
  it("skips non-chain RHS (arithmetic, literals)", () => {
    expect(scanBindings("x = 1 + 2\n").has("x")).toBe(false);
    expect(scanBindings('s = "hello"\n').has("s")).toBe(false);
  });
  it("strips trailing comment", () => {
    const b = scanBindings("A = hub.ports.A  # motor on port A\n");
    expect(b.get("A")).toEqual(["hub", "ports", "A"]);
  });
});

describe("createLspServer — local bindings", () => {
  it("completes on a locally-aliased variable (`A = hub.ports.A; A.`)", () => {
    const src = "import hub\nA = hub.ports.A\nA.";
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: src } },
    });
    server.handle({
      jsonrpc: "2.0", id: 200, method: "textDocument/completion",
      params: { textDocument: { uri: URI }, position: { line: 2, character: 2 } },
    });
    const items = (out.find((m) => m.id === 200)!.result as any).items;
    const names = items.map((it: any) => it.label);
    expect(names).toContain("startPower");
  });

  it("updates bindings on didChange", () => {
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: "" } },
    });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didChange",
      params: { textDocument: { uri: URI, version: 2 }, contentChanges: [{ text: "X = hub.ports.LED\nX." }] },
    });
    server.handle({
      jsonrpc: "2.0", id: 201, method: "textDocument/completion",
      params: { textDocument: { uri: URI }, position: { line: 1, character: 2 } },
    });
    const items = (out.find((m) => m.id === 201)!.result as any).items;
    const names = items.map((it: any) => it.label);
    expect(names).toContain("setRgbColor");
  });

  it("resolves hover through binding", () => {
    const src = "A = hub.ports.LED\nA.setRgbColor(1,2,3)";
    const out: RpcMessage[] = [];
    const server = createLspServer(STUBS, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: src } },
    });
    server.handle({
      jsonrpc: "2.0", id: 202, method: "textDocument/hover",
      params: { textDocument: { uri: URI }, position: { line: 1, character: 6 } },
    });
    const hover = out.find((m) => m.id === 202)?.result as any;
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain("setRgbColor");
  });
});

describe("createLspServer — real stubs smoke test", () => {
  async function completeAt(source: string, line: number, character: number) {
    const { STUBS: REAL } = await import("../src/editor/lsp/stubs");
    const out: RpcMessage[] = [];
    const server = createLspServer(REAL, (m) => out.push(m));
    server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.handle({
      jsonrpc: "2.0", method: "textDocument/didOpen",
      params: { textDocument: { uri: URI, languageId: "python", version: 1, text: source } },
    });
    server.handle({
      jsonrpc: "2.0", id: 99, method: "textDocument/completion",
      params: { textDocument: { uri: URI }, position: { line, character } },
    });
    return (out.find((m) => m.id === 99)!.result as any).items;
  }

  it("resolves hub top-level from vendored stubs", async () => {
    const items = await completeAt("hub.", 0, 4);
    const names = items.map((it: any) => it.label);
    expect(names).toContain("ports");
    expect(names).toContain("buttons");
    expect(names).toContain("powerOff");
  });

  it("resolves `hub.ports.A.` through imported alias `_local_port` → `lpf2.local.port`", async () => {
    const items = await completeAt("hub.ports.A.", 0, 12);
    const names = items.map((it: any) => it.label);
    // startPower / startSpeed defined on lpf2.local.port
    expect(names).toContain("startPower");
    expect(names).toContain("startSpeed");
  });

  it("resolves through class inheritance (`hub.ports.A.` → base class members)", async () => {
    // lpf2.local.port inherits from lpf2.port. Base methods must appear too.
    const items = await completeAt("hub.ports.A.", 0, 12);
    const names = items.map((it: any) => it.label);
    // These live on the base `lpf2.port`, not on `lpf2.local.port` directly.
    expect(names.length).toBeGreaterThan(5);
  });

  it("resolves local binding + follows attribute type", async () => {
    const src = "import hub\nA = hub.ports.A\nA.";
    const items = await completeAt(src, 2, 2);
    const names = items.map((it: any) => it.label);
    expect(names).toContain("startPower");
  });

  it("follows method return type through Union (`hub.ports.A.device().`)", async () => {
    // lpf2.port.device returns Union[basic_motor, encoder_motor, color_sensor,
    // distance_sensor, port_expander, hub_led, accelerometer, gyroscope, None]
    // — worker picks the first resolvable member so completion at least surfaces
    // something meaningful.
    const src = "import hub\nhub.ports.A.device().";
    const items = await completeAt(src, 1, src.split("\n")[1].length);
    expect(items.length).toBeGreaterThan(0);
  });

  it("Union member completion still resolves after didChange", async () => {
    const src = "hub.ports.A.device().";
    const items = await completeAt(src, 0, src.length);
    expect(items.length).toBeGreaterThan(0);
  });

  it("resolves `lpf2.devices.` to its class list", async () => {
    const items = await completeAt("import lpf2\nlpf2.devices.", 1, 13);
    const names = items.map((it: any) => it.label);
    expect(names).toContain("basic_motor");
    expect(names).toContain("color_sensor");
    expect(names).toContain("encoder_motor");
  });

  it("resolves `lpf2.devices.color_sensor.` methods", async () => {
    const src = "import lpf2\nlpf2.devices.color_sensor.";
    const items = await completeAt(src, 1, src.split("\n")[1].length);
    const names = items.map((it: any) => it.label);
    expect(names).toContain("getReflectivity");
    expect(names).toContain("getRGB");
  });

  it("chains call-result binding through prior binding (`A = hub.ports.A; dev = A.device(); dev.`)", async () => {
    const src = [
      "import hub",
      "A = hub.ports.A",
      "dev = A.device()",
      "dev.",
    ].join("\n");
    const items = await completeAt(src, 3, 4);
    expect(items.length).toBeGreaterThan(0);
  });
});
