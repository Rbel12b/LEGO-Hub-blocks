// Pure stub-driven LSP server. Testable without a Web Worker: feed messages
// via `handle()`, receive replies + notifications through the `emit` callback.
// The Web Worker wrapper (pyright.worker.ts) is a thin adapter around this.

import { buildIndex, childrenOf, resolveChain, type StubIndex, type Symbol as StubSymbol } from "./stubParser";

export interface RpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface LspServer {
  handle(msg: RpcMessage): void;
  /** Test/debug helper. */
  getDocument(uri: string): string | undefined;
}

/**
 * Build a server bound to the given stub set. `emit` is invoked for every
 * outbound message (responses to requests + publishDiagnostics notifications).
 */
export function createLspServer(stubs: Record<string, string>, emit: (msg: RpcMessage) => void): LspServer {
  const documents = new Map<string, string>();
  // Per-URI local binding table. Keys are user-defined names (`A`, `lv`);
  // values are the dotted chain of stub symbols they reference. Populated
  // from a shallow regex scan of the document on every didOpen/didChange
  // — good enough to resolve simple aliasing and single-hop assignments.
  const localBindings = new Map<string, Map<string, string[]>>();
  const index: StubIndex = buildIndex(stubs);

  function respond(id: number | string, result: unknown): void {
    emit({ jsonrpc: "2.0", id, result });
  }
  function notify(method: string, params: unknown): void {
    emit({ jsonrpc: "2.0", method, params });
  }

  /**
   * Rewrite `chain` so that if its head is a locally bound name, it starts
   * with the underlying stub chain instead. Runs iteratively to catch
   * chains-of-bindings.
   */
  function applyBindings(uri: string, chain: string[]): string[] {
    const table = localBindings.get(uri);
    if (!table || !chain.length) return chain;
    let out = chain;
    for (let i = 0; i < 8; i++) {
      const bind = table.get(out[0]);
      if (!bind) return out;
      out = [...bind, ...out.slice(1)];
    }
    return out;
  }

  function handleCompletion(params: any): unknown {
    const uri = params.textDocument.uri as string;
    const line = params.position.line as number;
    const character = params.position.character as number;
    const source = documents.get(uri) ?? "";
    const lineText = source.split("\n")[line] ?? "";
    const chain = chainAt(lineText, character);

    // Hide Python-private (`_`-prefixed) helpers unless the user is explicitly
    // typing an underscore. Vendored stubs expose lots of implementation
    // classes at module scope (e.g. `_Buttons`, `_Vec3`) that should not
    // appear in the completion popup.
    const query = chain.trailingDot ? "" : chain.parts[chain.parts.length - 1] ?? "";
    const wantsPrivate = query.startsWith("_");
    const notPrivate = (s: StubSymbol) => wantsPrivate || !s.name.startsWith("_");

    let items: StubSymbol[] = [];
    if (chain.trailingDot && chain.parts.length) {
      const target = resolveChain(index, applyBindings(uri, chain.parts));
      if (target) items = childrenOf(index, target).filter(notPrivate);
    } else if (chain.parts.length === 1 && !chain.trailingDot) {
      const q = chain.parts[0].toLowerCase();
      for (const [key, sym] of index.symbols) {
        if (!key.includes(".") && sym.name.toLowerCase().startsWith(q) && notPrivate(sym)) {
          items.push(sym);
        }
      }
      const table = localBindings.get(uri);
      if (table) {
        for (const [name, target] of table) {
          if (!name.toLowerCase().startsWith(q)) continue;
          const sym = resolveChain(index, target);
          if (sym) items.push({ ...sym, name, parent: "" });
        }
      }
    } else if (chain.parts.length > 1 && !chain.trailingDot) {
      const parent = resolveChain(index, applyBindings(uri, chain.parts.slice(0, -1)));
      if (parent) {
        const q = chain.parts[chain.parts.length - 1].toLowerCase();
        for (const child of childrenOf(index, parent)) {
          if (child.name.toLowerCase().startsWith(q) && notPrivate(child)) items.push(child);
        }
      }
    }

    return {
      isIncomplete: false,
      items: items.map((s) => ({
        label: s.name,
        kind: completionItemKind(s.kind),
        detail: s.detail.split("\n")[0],
        documentation: s.doc ? { kind: "markdown", value: s.doc } : undefined,
        insertText: s.name,
      })),
    };
  }

  function handleHover(params: any): unknown {
    const uri = params.textDocument.uri as string;
    const line = params.position.line as number;
    const character = params.position.character as number;
    const source = documents.get(uri) ?? "";
    const lineText = source.split("\n")[line] ?? "";
    let end = character;
    while (end < lineText.length && ID_CHAR.test(lineText[end])) end++;
    const chain = chainAt(lineText, end);
    if (!chain.parts.length) return null;
    const sym = resolveChain(index, applyBindings(uri, chain.parts));
    if (!sym) return null;
    const md = ["```python", sym.detail, "```"];
    if (sym.doc) md.push("", sym.doc);
    return { contents: { kind: "markdown", value: md.join("\n") } };
  }

  function handleSignatureHelp(params: any): unknown {
    const uri = params.textDocument.uri as string;
    const line = params.position.line as number;
    const character = params.position.character as number;
    const source = documents.get(uri) ?? "";
    const lineText = source.split("\n")[line] ?? "";
    let depth = 0;
    let openIdx = -1;
    let activeParam = 0;
    for (let i = character - 1; i >= 0; i--) {
      const c = lineText[i];
      if (c === ")") depth++;
      else if (c === "(") {
        if (depth === 0) { openIdx = i; break; }
        depth--;
      } else if (c === "," && depth === 0) activeParam++;
    }
    if (openIdx < 0) return null;
    const chain = chainAt(lineText, openIdx);
    if (!chain.parts.length) return null;
    const sym = resolveChain(index, applyBindings(uri, chain.parts));
    if (!sym || (sym.kind !== "function" && sym.kind !== "method")) return null;

    const signatures = sym.detail.split("\n").map((detail) => {
      const paramMatch = detail.match(/\(([^)]*)\)/);
      const params = paramMatch
        ? paramMatch[1]
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p && p !== "self")
            .map((p) => ({ label: p }))
        : [];
      return {
        label: detail,
        documentation: sym.doc ? { kind: "markdown", value: sym.doc } : undefined,
        parameters: params,
      };
    });

    return {
      signatures,
      activeSignature: 0,
      activeParameter: Math.min(activeParam, Math.max(0, (signatures[0]?.parameters.length ?? 1) - 1)),
    };
  }

  function diagnose(uri: string, source: string): void {
    const diagnostics: unknown[] = [];
    const lines = source.split("\n");
    const stack: { ch: string; line: number; col: number }[] = [];
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    lines.forEach((ln, li) => {
      if (/^\t* +\t/.test(ln)) {
        diagnostics.push({
          range: { start: { line: li, character: 0 }, end: { line: li, character: ln.length } },
          severity: 2,
          message: "Mixed tabs and spaces in indentation",
          source: "lego-hub-lsp",
        });
      }
      let inStr: string | null = null;
      for (let c = 0; c < ln.length; c++) {
        const ch = ln[c];
        if (inStr) { if (ch === inStr && ln[c - 1] !== "\\") inStr = null; continue; }
        if (ch === '"' || ch === "'") { inStr = ch; continue; }
        if (ch === "#") break;
        if ("([{".includes(ch)) stack.push({ ch, line: li, col: c });
        else if (")]}".includes(ch)) {
          const top = stack.pop();
          if (!top || top.ch !== pairs[ch]) {
            diagnostics.push({
              range: { start: { line: li, character: c }, end: { line: li, character: c + 1 } },
              severity: 1,
              message: `Unmatched '${ch}'`,
              source: "lego-hub-lsp",
            });
          }
        }
      }
    });
    for (const open of stack) {
      diagnostics.push({
        range: { start: { line: open.line, character: open.col }, end: { line: open.line, character: open.col + 1 } },
        severity: 1,
        message: `Unclosed '${open.ch}'`,
        source: "lego-hub-lsp",
      });
    }
    notify("textDocument/publishDiagnostics", { uri, diagnostics });
  }

  function handle(msg: RpcMessage): void {
    if (!msg || msg.jsonrpc !== "2.0") return;
    try {
      switch (msg.method) {
        case "initialize":
          respond(msg.id!, {
            capabilities: {
              textDocumentSync: 1,
              completionProvider: { triggerCharacters: ["."] },
              hoverProvider: true,
              signatureHelpProvider: { triggerCharacters: ["(", ","] },
              definitionProvider: false,
            },
            serverInfo: { name: "lego-hub-stub-lsp", version: "0.1.0" },
          });
          break;
        case "initialized":
        case "workspace/didChangeConfiguration":
          break;
        case "shutdown":
          respond(msg.id!, null);
          break;
        case "exit":
          break;
        case "textDocument/didOpen": {
          const p = msg.params as any;
          documents.set(p.textDocument.uri, p.textDocument.text);
          localBindings.set(p.textDocument.uri, scanBindings(p.textDocument.text));
          diagnose(p.textDocument.uri, p.textDocument.text);
          break;
        }
        case "textDocument/didChange": {
          const p = msg.params as any;
          const change = p.contentChanges[p.contentChanges.length - 1];
          documents.set(p.textDocument.uri, change.text);
          localBindings.set(p.textDocument.uri, scanBindings(change.text));
          diagnose(p.textDocument.uri, change.text);
          break;
        }
        case "textDocument/didClose": {
          const p = msg.params as any;
          documents.delete(p.textDocument.uri);
          localBindings.delete(p.textDocument.uri);
          break;
        }
        case "textDocument/completion":
          respond(msg.id!, handleCompletion(msg.params));
          break;
        case "textDocument/hover":
          respond(msg.id!, handleHover(msg.params));
          break;
        case "textDocument/signatureHelp":
          respond(msg.id!, handleSignatureHelp(msg.params));
          break;
        default:
          if (msg.id !== undefined) respond(msg.id, null);
      }
    } catch (e) {
      if (msg.id !== undefined) {
        emit({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e) } });
      }
    }
  }

  return {
    handle,
    getDocument: (uri) => documents.get(uri),
  };
}

// ── Chain extraction ────────────────────────────────────────────────────────

const ID_CHAR = /[A-Za-z0-9_]/;

interface Chain {
  parts: string[];
  trailingDot: boolean;
  wordStart: number;
}

/**
 * Walk backwards from the cursor over `ident (call)? (.ident (call)?)*` to
 * build the dotted chain being typed. Balanced `(...)` and `[...]` trailers
 * are skipped — so `hub.ports.A.device().` yields the same chain as
 * `hub.ports.A.device.`. The resolver knows how to follow return types.
 */
export function chainAt(line: string, col: number): Chain {
  let i = col;
  const parts: string[] = [];
  let cur = "";
  while (i > 0 && ID_CHAR.test(line[i - 1])) {
    i--;
    cur = line[i] + cur;
  }
  const wordStart = i;
  const trailingDot = cur === "" && i > 0 && line[i - 1] === ".";
  if (cur) parts.unshift(cur);
  while (i > 0 && line[i - 1] === ".") {
    i--;
    // Skip balanced call / subscript trailer(s) that precede the identifier.
    while (i > 0 && (line[i - 1] === ")" || line[i - 1] === "]")) {
      const open = line[i - 1] === ")" ? "(" : "[";
      const close = line[i - 1];
      let depth = 1;
      let j = i - 2;
      while (j >= 0 && depth > 0) {
        if (line[j] === close) depth++;
        else if (line[j] === open) depth--;
        j--;
      }
      if (depth !== 0) return { parts, trailingDot, wordStart };
      i = j + 1;
    }
    let seg = "";
    while (i > 0 && ID_CHAR.test(line[i - 1])) {
      i--;
      seg = line[i] + seg;
    }
    if (!seg) break;
    parts.unshift(seg);
  }
  return { parts, trailingDot, wordStart };
}

function completionItemKind(kind: StubSymbol["kind"]): number {
  switch (kind) {
    case "module": return 9;
    case "class": return 7;
    case "function": return 3;
    case "method": return 2;
    case "attribute": return 5;
    case "variable": return 6;
  }
}

const ASSIGN_RHS_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*(?:#.*)?$/;
const IMPORT_AS_RE = /^\s*import\s+([A-Za-z_][A-Za-z0-9_.]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)/;
const FROM_IMPORT_RE = /^\s*from\s+([A-Za-z_][A-Za-z0-9_.]*)\s+import\s+(.+)$/;

/** Drop balanced `()` and `[]` trailers so `A.device()` collapses to `A.device`. */
function stripCalls(s: string): string {
  let out = "";
  let depth = 0;
  for (const c of s) {
    if (c === "(" || c === "[") { depth++; continue; }
    if (c === ")" || c === "]") { if (depth > 0) depth--; continue; }
    if (depth === 0) out += c;
  }
  return out;
}

/**
 * Scan a document for simple name bindings so completion can follow
 * user-defined aliases. Supports:
 *   - `X = <dotted>`  (single-line assignment to a stub expression)
 *   - `import M as A`
 *   - `from M import A [as B]`
 *
 * Deliberately shallow: no call expressions, no augmented assignments,
 * no scope tracking. Good enough for the block-generated code shape
 * and for casual hand-written scripts.
 */
export function scanBindings(source: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const raw of source.split("\n")) {
    const line = raw.replace(/\s*#.*$/, "");
    let m: RegExpMatchArray | null;
    if ((m = line.match(IMPORT_AS_RE))) {
      out.set(m[2], m[1].split("."));
      continue;
    }
    if ((m = line.match(FROM_IMPORT_RE))) {
      const mod = m[1].split(".");
      for (const part of m[2].split(",")) {
        const seg = part.trim();
        if (!seg) continue;
        const asMatch = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (asMatch) out.set(asMatch[2], [...mod, asMatch[1]]);
        else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(seg)) out.set(seg, [...mod, seg]);
      }
      continue;
    }
    if ((m = line.match(ASSIGN_RHS_RE))) {
      const stripped = stripCalls(m[2]).trim();
      if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(stripped)) {
        out.set(m[1], stripped.split("."));
      }
    }
  }
  return out;
}

