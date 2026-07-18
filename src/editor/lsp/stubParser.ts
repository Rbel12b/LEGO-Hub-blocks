// Lightweight .pyi parser. Extracts modules, classes, functions/methods, and
// attribute types. Runs in the browser LSP worker. Not a full Python parser —
// covers the stubs we vendor (upstream lpf2 / hub / lvgl / typeshed shape).
//
// Emits a flat symbol table where every dotted name (`hub`, `hub.ports`,
// `hub.ports.LED`, `hub.ports.LED.setRgbColor`) maps to one Symbol. The LSP
// worker resolves completion / hover / signature by walking the same dot chain.

export type SymbolKind = "module" | "class" | "function" | "method" | "attribute" | "variable";

export interface Symbol {
  name: string;
  kind: SymbolKind;
  detail: string;      // one-line signature or type annotation
  doc: string;         // preceding # or triple-quoted docstring
  parent: string;      // dotted parent, "" for top-level module
  typeRef?: string;    // for attributes: unresolved annotation string
  children: string[];  // names of direct children (for completion)
}

export interface StubIndex {
  symbols: Map<string, Symbol>;
  // Alias table: unqualified name in a given module → dotted target. Used to
  // resolve `imu: _imu_module` → look up `_imu_module` attributes.
  moduleTypes: Map<string, string>;
}

const CLASS_RE = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*:/;
const DEF_RE = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(->\s*[^:]+)?:/;
const ATTR_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)(?:\s*=.*)?$/;
const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

function stripComment(line: string): string {
  // naïve: drop `#` outside quotes; good enough for stubs
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === inStr && line[i - 1] !== "\\") inStr = null;
    } else if (c === '"' || c === "'") {
      inStr = c as '"' | "'";
    } else if (c === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

interface Scope {
  indent: number;
  path: string;   // dotted path of the enclosing class/module
}

/**
 * Parse a single .pyi file at virtual path `filePath` (POSIX). The module
 * name is derived from the path: `lpf2/__init__.pyi` → `lpf2`,
 * `lpf2/devices/__init__.pyi` → `lpf2.devices`, `hub.pyi` → `hub`.
 */
export function parseStub(filePath: string, source: string, index: StubIndex): void {
  const mod = moduleNameOf(filePath);
  if (!mod) return;
  ensureModule(index, mod);

  const lines = source.split("\n");
  const scopes: Scope[] = [{ indent: -1, path: mod }];
  let pendingDoc = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Doc-collecting must precede stripComment (which erases the entire line
    // when it starts with `#`).
    if (/^\s*#/.test(rawLine)) {
      pendingDoc = (pendingDoc ? pendingDoc + "\n" : "") + rawLine.replace(/^\s*#\s?/, "");
      continue;
    }
    const line = stripComment(rawLine).trimEnd();
    if (!line.trim()) {
      pendingDoc = "";
      continue;
    }
    // capture triple-quoted docstring lazily as leading comment substitute
    if (/^\s*"""/.test(line)) {
      const collected: string[] = [];
      let j = i;
      const startIdx = line.indexOf('"""');
      const endSame = line.indexOf('"""', startIdx + 3);
      if (endSame !== -1) {
        collected.push(line.slice(startIdx + 3, endSame));
      } else {
        collected.push(line.slice(startIdx + 3));
        for (j = i + 1; j < lines.length; j++) {
          const end = lines[j].indexOf('"""');
          if (end !== -1) {
            collected.push(lines[j].slice(0, end));
            break;
          }
          collected.push(lines[j]);
        }
        i = j;
      }
      pendingDoc = collected.join("\n").trim();
      continue;
    }

    const ind = indentOf(rawLine);
    while (scopes.length > 1 && ind <= scopes[scopes.length - 1].indent) scopes.pop();
    const parent = scopes[scopes.length - 1].path;
    const body = line.trim();

    let m: RegExpMatchArray | null;
    if ((m = body.match(CLASS_RE))) {
      const name = m[1];
      const dotted = `${parent}.${name}`;
      addSymbol(index, dotted, {
        name,
        kind: "class",
        detail: `class ${name}${m[2] ? `(${m[2].trim()})` : ""}`,
        doc: pendingDoc,
        parent,
        children: [],
      });
      scopes.push({ indent: ind, path: dotted });
    } else if ((m = body.match(DEF_RE))) {
      const name = m[1];
      const params = m[2];
      const ret = m[3] ? m[3].trim() : "";
      const dotted = `${parent}.${name}`;
      const parentSym = index.symbols.get(parent);
      const kind: SymbolKind = parentSym && parentSym.kind === "class" ? "method" : "function";
      addSymbol(index, dotted, {
        name,
        kind,
        detail: `${kind === "method" ? "" : "def "}${name}(${params}) ${ret}`.trim(),
        doc: pendingDoc,
        parent,
        children: [],
      });
    } else if ((m = body.match(ATTR_RE))) {
      const name = m[1];
      const typeStr = m[2].trim().replace(/^"(.*)"$/, "$1");
      const dotted = `${parent}.${name}`;
      addSymbol(index, dotted, {
        name,
        kind: parent === mod ? "variable" : "attribute",
        detail: `${name}: ${typeStr}`,
        doc: pendingDoc,
        parent,
        typeRef: typeStr,
        children: [],
      });
    } else if ((m = body.match(ASSIGN_RE))) {
      const name = m[1];
      const dotted = `${parent}.${name}`;
      addSymbol(index, dotted, {
        name,
        kind: "variable",
        detail: `${name} = ${m[2].trim()}`,
        doc: pendingDoc,
        parent,
        children: [],
      });
    }
    pendingDoc = "";
  }
}

export function buildIndex(files: Record<string, string>): StubIndex {
  const index: StubIndex = { symbols: new Map(), moduleTypes: new Map() };
  for (const [path, src] of Object.entries(files)) {
    if (!path.endsWith(".pyi")) continue;
    parseStub(path, src, index);
  }
  resolveTypeRefs(index);
  return index;
}

function moduleNameOf(filePath: string): string | null {
  if (!filePath.endsWith(".pyi")) return null;
  const trimmed = filePath.replace(/\.pyi$/, "");
  const parts = trimmed.split("/");
  if (parts[parts.length - 1] === "__init__") parts.pop();
  return parts.join(".");
}

function ensureModule(index: StubIndex, mod: string): void {
  if (!mod || index.symbols.has(mod)) return;
  index.symbols.set(mod, {
    name: mod.split(".").pop() ?? mod,
    kind: "module",
    detail: `module ${mod}`,
    doc: "",
    parent: "",
    children: [],
  });
}

function addSymbol(index: StubIndex, dotted: string, sym: Symbol): void {
  const existing = index.symbols.get(dotted);
  if (existing) {
    // Merge overloads / re-declarations: keep first, append detail line.
    if (sym.detail && !existing.detail.includes(sym.detail)) {
      existing.detail = `${existing.detail}\n${sym.detail}`;
    }
    if (sym.doc && !existing.doc) existing.doc = sym.doc;
    return;
  }
  index.symbols.set(dotted, sym);
  const parent = index.symbols.get(sym.parent);
  if (parent && !parent.children.includes(sym.name)) parent.children.push(sym.name);
}

/**
 * For each attribute whose type is another dotted symbol we know, populate
 * `children` on the attribute so completion on `hub.ports.` finds `A`, `B`,
 * `LED`, etc. (defined on `hub._ports_module`).
 */
function resolveTypeRefs(index: StubIndex): void {
  for (const sym of index.symbols.values()) {
    if (!sym.typeRef || sym.children.length) continue;
    const target = findTypeTarget(index, sym);
    if (!target) continue;
    sym.children = [...target.children];
    // Point child lookups at the target so nested `hub.ports.A.startPower`
    // works too. We do this by recording a "typeOf" mapping via detail hack.
    index.moduleTypes.set(qualifiedName(sym), qualifiedName(target));
  }
}

function findTypeTarget(index: StubIndex, sym: Symbol): Symbol | null {
  const t = (sym.typeRef ?? "").replace(/^"(.*)"$/, "$1").trim();
  if (!t) return null;
  // strip generics / unions — first token good enough for stubs we ship
  const bare = t.split(/[[|,\s]/)[0];
  if (!bare) return null;
  // search: try same-module sibling, then any module
  const parentMod = sym.parent.split(".")[0];
  const candidates = [
    `${parentMod}.${bare}`,
    bare,
  ];
  for (const c of candidates) {
    const hit = index.symbols.get(c);
    if (hit) return hit;
  }
  for (const [key, s] of index.symbols) {
    if (key.endsWith(`.${bare}`) && s.kind === "class") return s;
  }
  return null;
}

function qualifiedName(sym: Symbol): string {
  return sym.parent ? `${sym.parent}.${sym.name}` : sym.name;
}

/**
 * Resolve a dotted chain (e.g. `hub.ports.A`) against the index, following
 * attribute type refs. Returns the terminal symbol or null.
 */
export function resolveChain(index: StubIndex, parts: string[]): Symbol | null {
  if (!parts.length) return null;
  let cur = index.symbols.get(parts[0]);
  if (!cur) return null;
  for (let i = 1; i < parts.length; i++) {
    const via = index.moduleTypes.get(qualifiedName(cur));
    const base = via ?? qualifiedName(cur);
    const next = index.symbols.get(`${base}.${parts[i]}`);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** Children of a symbol, following its typeRef if it points to a class. */
export function childrenOf(index: StubIndex, sym: Symbol): Symbol[] {
  const via = index.moduleTypes.get(qualifiedName(sym));
  const base = via ?? qualifiedName(sym);
  const out: Symbol[] = [];
  const seen = new Set<string>();
  const owner = index.symbols.get(base);
  const names = owner ? owner.children : sym.children;
  for (const n of names) {
    const child = index.symbols.get(`${base}.${n}`);
    if (child && !seen.has(n)) {
      seen.add(n);
      out.push(child);
    }
  }
  return out;
}
