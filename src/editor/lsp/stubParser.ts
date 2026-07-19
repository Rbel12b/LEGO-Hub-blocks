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
  bases?: string[];    // for classes: base class references (raw, unresolved)
  home?: string;       // module the symbol was declared in (used for alias lookup)
}

export interface StubIndex {
  symbols: Map<string, Symbol>;
  // Attribute-symbol → dotted target class. Populated during resolution so
  // `hub.ports.` finds `A`, `B`, `LED`, etc.
  moduleTypes: Map<string, string>;
  // Per-module import aliases. `hub` module gets:
  //   `_local_port` → `lpf2.local.port`
  //   `_port`       → `lpf2.port`
  // Populated from `from X import Y as Z` / `import X as Y` lines.
  imports: Map<string, Map<string, string>>;
}

const CLASS_RE = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*:/;
const DEF_RE = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(->\s*[^:]+)?:/;
const ATTR_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)(?:\s*=.*)?$/;
const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
const IMPORT_AS_RE = /^import\s+([A-Za-z_][A-Za-z0-9_.]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)/;
const IMPORT_RE = /^import\s+([A-Za-z_][A-Za-z0-9_.]*)$/;
const FROM_IMPORT_RE = /^from\s+(\.*[A-Za-z_][A-Za-z0-9_.]*)\s+import\s+(.+)$/;

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

/**
 * True once the joined signature has balanced brackets and terminates with
 * `:` (optionally followed by `...` for a stub body).
 */
function endsSignature(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
  }
  if (depth !== 0) return false;
  return /:\s*(\.\.\.)?\s*$/.test(s);
}

function stripComment(line: string): string {
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
  path: string;
}

/**
 * Parse a single .pyi file. Module name derives from the path:
 * `lpf2/__init__.pyi` → `lpf2`, `lpf2/devices/__init__.pyi` → `lpf2.devices`,
 * `hub.pyi` → `hub`.
 */
export function parseStub(filePath: string, source: string, index: StubIndex): void {
  const mod = moduleNameOf(filePath);
  if (!mod) return;
  ensureModule(index, mod);
  const modAliases = ensureAliases(index, mod);

  const lines = source.split("\n");
  const scopes: Scope[] = [{ indent: -1, path: mod }];
  let pendingDoc = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (/^\s*#/.test(rawLine)) {
      pendingDoc = (pendingDoc ? pendingDoc + "\n" : "") + rawLine.replace(/^\s*#\s?/, "");
      continue;
    }
    const line = stripComment(rawLine).trimEnd();
    if (!line.trim()) {
      pendingDoc = "";
      continue;
    }
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
    let body = line.trim();

    // Multi-line def signatures: `def f(...) -> Union[\n    A,\n    B,\n]: ...`
    // The parser needs the whole signature in `body`, so glue continuation
    // lines until brackets are balanced and we see a trailing `:`.
    if (/^(def|class)\b/.test(body) && !endsSignature(body)) {
      let k = i;
      while (k + 1 < lines.length && !endsSignature(body)) {
        k++;
        body += " " + stripComment(lines[k]).trim();
      }
      i = k;
    }

    let m: RegExpMatchArray | null;

    // ── Import handling: extend the module's alias table. ──
    if (parent === mod && (m = body.match(IMPORT_AS_RE))) {
      modAliases.set(m[2], m[1]);
      pendingDoc = "";
      continue;
    }
    if (parent === mod && (m = body.match(IMPORT_RE))) {
      const target = m[1];
      const leaf = target.split(".").pop()!;
      modAliases.set(leaf, target);
      pendingDoc = "";
      continue;
    }
    if (parent === mod && (m = body.match(FROM_IMPORT_RE))) {
      const src = resolveRelative(mod, m[1]);
      for (const part of m[2].replace(/^\(|\)$/g, "").split(",")) {
        const seg = part.trim();
        if (!seg) continue;
        const asMatch = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (asMatch) modAliases.set(asMatch[2], `${src}.${asMatch[1]}`);
        else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(seg)) modAliases.set(seg, `${src}.${seg}`);
      }
      pendingDoc = "";
      continue;
    }

    if ((m = body.match(CLASS_RE))) {
      const name = m[1];
      const dotted = `${parent}.${name}`;
      const bases = m[2]
        ? m[2]
            .split(",")
            .map((s) => s.trim().split(/[[|,\s]/)[0])
            .filter((s) => s && s !== "object" && !s.includes("="))
        : [];
      addSymbol(index, dotted, {
        name,
        kind: "class",
        detail: `class ${name}${m[2] ? `(${m[2].trim()})` : ""}`,
        doc: pendingDoc,
        parent,
        children: [],
        bases,
        home: mod,
      });
      scopes.push({ indent: ind, path: dotted });
    } else if ((m = body.match(DEF_RE))) {
      const name = m[1];
      const params = m[2];
      const ret = m[3] ? m[3].trim() : "";
      const dotted = `${parent}.${name}`;
      const parentSym = index.symbols.get(parent);
      const kind: SymbolKind = parentSym && parentSym.kind === "class" ? "method" : "function";
      const returnAnn = ret.replace(/^->\s*/, "").trim();
      addSymbol(index, dotted, {
        name,
        kind,
        detail: `${kind === "method" ? "" : "def "}${name}(${params}) ${ret}`.trim(),
        doc: pendingDoc,
        parent,
        children: [],
        home: mod,
        typeRef: returnAnn || undefined,
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
        home: mod,
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
        home: mod,
      });
    }
    pendingDoc = "";
  }
}

export function buildIndex(files: Record<string, string>): StubIndex {
  const index: StubIndex = { symbols: new Map(), moduleTypes: new Map(), imports: new Map() };
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
  if (!mod) return;
  // Make sure every ancestor module exists so `lpf2.devices` gets a proper
  // parent chain — otherwise `qualifiedName` reconstructs the wrong dotted
  // key and `childrenOf` looks up children under the leaf segment.
  const parts = mod.split(".");
  for (let i = 0; i < parts.length; i++) {
    const dotted = parts.slice(0, i + 1).join(".");
    if (index.symbols.has(dotted)) continue;
    const parent = i === 0 ? "" : parts.slice(0, i).join(".");
    const name = parts[i];
    index.symbols.set(dotted, {
      name,
      kind: "module",
      detail: `module ${dotted}`,
      doc: "",
      parent,
      children: [],
      home: dotted,
    });
    if (parent) {
      const parentSym = index.symbols.get(parent);
      if (parentSym && !parentSym.children.includes(name)) parentSym.children.push(name);
    }
  }
}

function ensureAliases(index: StubIndex, mod: string): Map<string, string> {
  let t = index.imports.get(mod);
  if (!t) {
    t = new Map();
    index.imports.set(mod, t);
  }
  return t;
}

/**
 * Resolve a `from` clause including relative dots: `.` = current module,
 * `..` = parent. `from . import color` inside `lpf2` → `lpf2.color`.
 */
function resolveRelative(currentMod: string, target: string): string {
  const dots = target.match(/^\.+/)?.[0].length ?? 0;
  if (!dots) return target;
  const rest = target.slice(dots);
  const parts = currentMod.split(".");
  const up = dots - 1;
  const base = parts.slice(0, Math.max(0, parts.length - up)).join(".");
  return rest ? (base ? `${base}.${rest}` : rest) : base;
}

function addSymbol(index: StubIndex, dotted: string, sym: Symbol): void {
  const existing = index.symbols.get(dotted);
  if (existing) {
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
 * For each attribute whose type is another dotted symbol we know, record a
 * `moduleTypes` mapping so completion on `hub.ports.` finds `A`, `B`, `LED`.
 */
function resolveTypeRefs(index: StubIndex): void {
  for (const sym of index.symbols.values()) {
    if (!sym.typeRef) continue;
    const target = findTypeTarget(index, sym);
    if (!target) continue;
    index.moduleTypes.set(qualifiedName(sym), qualifiedName(target));
  }
}

function findTypeTarget(index: StubIndex, sym: Symbol): Symbol | null {
  const t = (sym.typeRef ?? "").replace(/^"(.*)"$/, "$1").trim();
  if (!t) return null;
  const home = sym.home ?? sym.parent.split(".")[0];
  return firstResolvable(index, home, sym.parent, t);
}

/**
 * Given a type annotation, walk into `Union[...]`, `Optional[...]`, and
 * `X | Y` unions to find the first member that resolves to a known class
 * or module symbol. `None` members are skipped.
 */
function firstResolvable(index: StubIndex, home: string, parent: string, raw: string): Symbol | null {
  const t = raw.trim().replace(/^"(.*)"$/, "$1");
  if (!t) return null;

  const opt = t.match(/^Optional\s*\[(.+)\]\s*$/);
  if (opt) return firstResolvable(index, home, parent, opt[1]);

  const union = t.match(/^Union\s*\[([\s\S]+)\]\s*$/);
  if (union) {
    for (const member of splitTopLevel(union[1], ",")) {
      const trimmed = member.trim();
      if (trimmed === "None" || trimmed === "NoneType") continue;
      const hit = firstResolvable(index, home, parent, trimmed);
      if (hit) return hit;
    }
    return null;
  }

  if (containsTopLevel(t, "|")) {
    for (const member of splitTopLevel(t, "|")) {
      const trimmed = member.trim();
      if (trimmed === "None" || trimmed === "NoneType") continue;
      const hit = firstResolvable(index, home, parent, trimmed);
      if (hit) return hit;
    }
    return null;
  }

  // Strip generic parameters: `list[X]` / `List[X]` → `list`. We don't
  // introspect element types today — completion after `.list[0].` would
  // need real type inference. Names with no bracket pass through.
  const bare = t.split(/[[|,\s]/)[0];
  if (!bare) return null;
  return resolveTypeRef(index, home, parent, bare);
}

/** Split a comma/pipe list respecting nested `[]` / `()` brackets. */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (depth === 0 && c === sep) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

function containsTopLevel(s: string, ch: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (depth === 0 && c === ch) return true;
  }
  return false;
}

/**
 * Given a raw name (`_local_port`, `_ports_module`, `lpf2.color`), find the
 * symbol it refers to. Checks module import aliases, then same-module
 * siblings, then any module.
 */
function resolveTypeRef(index: StubIndex, home: string, parent: string, bare: string): Symbol | null {
  if (index.symbols.has(bare)) return index.symbols.get(bare)!;

  // Follow module import aliases: `_local_port` → `lpf2.local.port`.
  const homeAliases = index.imports.get(home);
  if (homeAliases) {
    const head = bare.split(".")[0];
    const aliased = homeAliases.get(head);
    if (aliased) {
      const remainder = bare.slice(head.length);
      const full = aliased + remainder;
      const hit = index.symbols.get(full);
      if (hit) return hit;
    }
  }

  const candidates = [
    `${home}.${bare}`,
    `${parent}.${bare}`,
    bare,
  ];
  for (const c of candidates) {
    const hit = index.symbols.get(c);
    if (hit) return hit;
  }
  for (const [key, s] of index.symbols) {
    if (key.endsWith(`.${bare}`) && (s.kind === "class" || s.kind === "module")) return s;
  }
  return null;
}

function qualifiedName(sym: Symbol): string {
  return sym.parent ? `${sym.parent}.${sym.name}` : sym.name;
}

/**
 * Resolve a dotted chain against the index, following attribute type refs
 * and class inheritance. Returns the terminal symbol or null.
 */
export function resolveChain(index: StubIndex, parts: string[]): Symbol | null {
  if (!parts.length) return null;
  let cur = index.symbols.get(parts[0]);
  if (!cur) return null;
  for (let i = 1; i < parts.length; i++) {
    const targetSym = followType(index, cur);
    const base = qualifiedName(targetSym);
    let next = index.symbols.get(`${base}.${parts[i]}`);
    if (!next && targetSym.bases?.length) {
      next = lookupInBases(index, targetSym, parts[i]);
    }
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** Walk to the underlying class/module a symbol represents. */
function followType(index: StubIndex, sym: Symbol): Symbol {
  const via = index.moduleTypes.get(qualifiedName(sym));
  if (!via) return sym;
  const hit = index.symbols.get(via);
  return hit ?? sym;
}

function lookupInBases(index: StubIndex, cls: Symbol, member: string): Symbol | undefined {
  const seen = new Set<string>();
  const queue: Symbol[] = [cls];
  while (queue.length) {
    const c = queue.shift()!;
    const q = qualifiedName(c);
    if (seen.has(q)) continue;
    seen.add(q);
    for (const base of c.bases ?? []) {
      const b = resolveTypeRef(index, c.home ?? "", c.parent, base);
      if (!b) continue;
      const hit = index.symbols.get(`${qualifiedName(b)}.${member}`);
      if (hit) return hit;
      queue.push(b);
    }
  }
  return undefined;
}

/** Children of a symbol, following its typeRef and class inheritance. */
export function childrenOf(index: StubIndex, sym: Symbol): Symbol[] {
  const target = followType(index, sym);
  const out: Symbol[] = [];
  const seenNames = new Set<string>();
  const seenClasses = new Set<string>();
  const stack: Symbol[] = [target];

  while (stack.length) {
    const c = stack.shift()!;
    const q = qualifiedName(c);
    if (seenClasses.has(q)) continue;
    seenClasses.add(q);
    for (const n of c.children) {
      if (seenNames.has(n)) continue;
      const child = index.symbols.get(`${q}.${n}`);
      if (child) {
        seenNames.add(n);
        out.push(child);
      }
    }
    for (const base of c.bases ?? []) {
      const b = resolveTypeRef(index, c.home ?? "", c.parent, base);
      if (b) stack.push(b);
    }
  }
  return out;
}
