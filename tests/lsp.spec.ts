import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../src/project/format";
import { buildIndex, resolveChain, childrenOf, parseStub } from "../src/editor/lsp/stubParser";

describe("ProjectSettings defaults", () => {
  it("defaults LSP to in-browser worker mode", () => {
    expect(DEFAULT_SETTINGS.lspMode).toBe("worker");
    expect(DEFAULT_SETTINGS.lspRemoteUrl).toMatch(/^ws:\/\//);
  });
});

describe("stubParser", () => {
  const HUB_STUB = `
class _Ports:
    A: _Motor
    B: _Motor
    LED: _LED

class _LED:
    def setRgbColor(self, r: int, g: int, b: int) -> None: ...

class _Motor:
    def startPower(self, power: int) -> None: ...

ports: _Ports
`.trimStart();

  it("indexes module attributes and follows type refs", () => {
    const idx = buildIndex({ "hub.pyi": HUB_STUB });
    const ports = resolveChain(idx, ["hub", "ports"]);
    expect(ports).not.toBeNull();
    expect(ports!.kind).toBe("variable");

    const led = resolveChain(idx, ["hub", "ports", "LED"]);
    expect(led).not.toBeNull();
    expect(led!.name).toBe("LED");

    const setRgb = resolveChain(idx, ["hub", "ports", "LED", "setRgbColor"]);
    expect(setRgb).not.toBeNull();
    expect(setRgb!.kind).toBe("method");
    expect(setRgb!.detail).toContain("setRgbColor(self, r: int, g: int, b: int)");
  });

  it("returns direct children after following a type ref", () => {
    const idx = buildIndex({ "hub.pyi": HUB_STUB });
    const ports = resolveChain(idx, ["hub", "ports"])!;
    const names = childrenOf(idx, ports).map((c) => c.name).sort();
    expect(names).toEqual(["A", "B", "LED"]);
  });

  it("parses package tree (lpf2/__init__ + lpf2/color)", () => {
    const idx = buildIndex({
      "lpf2/__init__.pyi": "from . import color\n",
      "lpf2/color.pyi": "BLACK: int\nBLUE: int\nRED: int\n",
    });
    expect(idx.symbols.has("lpf2")).toBe(true);
    expect(idx.symbols.has("lpf2.color")).toBe(true);
    expect(idx.symbols.has("lpf2.color.BLUE")).toBe(true);
  });

  it("handles docstrings and comment leaders", () => {
    const idx: ReturnType<typeof buildIndex> = { symbols: new Map(), moduleTypes: new Map(), imports: new Map() };
    parseStub(
      "widget.pyi",
      [
        "# Widget entry point.",
        "class Widget:",
        '    """Docstring for widget."""',
        "    def draw(self) -> None: ...",
        "",
      ].join("\n"),
      idx,
    );
    const cls = idx.symbols.get("widget.Widget");
    expect(cls?.doc).toContain("Widget entry point");
    const draw = idx.symbols.get("widget.Widget.draw");
    expect(draw?.detail).toContain("draw(self)");
  });
});
