import type { Block, Workspace } from "blockly";
import { pythonGenerator } from "blockly/python";
import { registerAllBlocks } from "../blocks";
import { resetSetup } from "../blocks/setup";

registerAllBlocks();

const DEFS_SEPARATOR = "\n\n\n";
const SETUP_HAT = "on_setup";
const LOOP_HAT = "on_loop";
const PROC_TYPES = new Set(["procedures_defnoreturn", "procedures_defreturn"]);
const HUB_ON_IMPORT_KEY = "hub_on_import";

function indentBody(text: string): string {
  const t = text.replace(/\s+$/, "");
  if (!t) return "    pass";
  return t
    .split("\n")
    .map((l) => (l.length ? "    " + l : l))
    .join("\n");
}

/**
 * Emit Python for a workspace. `on_setup` hat body becomes `def setup()`,
 * `on_loop` cap body becomes `def loop()`, both registered via the runner's
 * `@on("setup")` / `@on("loop")` decorators. Procedure defs become top-level
 * `def`s via Blockly's normal definitions_ machinery. Orphan blocks are ignored.
 */
export function workspaceToPython(workspace: Workspace): string {
  resetSetup();
  const gen = pythonGenerator;
  gen.init(workspace);

  for (const top of workspace.getTopBlocks(true)) {
    if (PROC_TYPES.has(top.type)) gen.blockToCode(top);
  }

  const setupBodies: string[] = [];
  const loopBodies: string[] = [];
  for (const top of workspace.getTopBlocks(true)) {
    if (top.type === SETUP_HAT) {
      const next: Block | null = top.getNextBlock();
      if (!next) continue;
      const code = gen.blockToCode(next);
      const text = Array.isArray(code) ? code[0] : code;
      if (text) setupBodies.push(text);
    } else if (top.type === LOOP_HAT) {
      const body = gen.statementToCode(top, "DO");
      if (body) loopBodies.push(body);
    }
  }

  const emitDefs: string[] = [];

  (gen as unknown as { definitions_: Record<string, string> }).definitions_[HUB_ON_IMPORT_KEY] = "from hub import on";

  if (setupBodies.length) {
    const joined = setupBodies.join("").replace(/\s+$/, "");
    emitDefs.push(`@on("setup")\ndef setup():\n${indentBody(joined)}`);
  }
  else {
    emitDefs.push(`@on("setup")\ndef setup():`);
  }

  if (loopBodies.length) {
    const joined = loopBodies.join("").replace(/\s+$/, "");
    emitDefs.push(`@on("loop")\ndef loop():\n${indentBody(joined)}`);
  }
  else {
    emitDefs.push(`@on("loop")\ndef loop():\n`);
  }

  const body = emitDefs.join("\n\n\n").replace(/\s+$/, "");
  const combined = gen.finish("");
  (gen as unknown as { definitions_: Record<string, string> }).definitions_ = {};

  const sepIdx = combined.indexOf(DEFS_SEPARATOR);
  const preamble = sepIdx >= 0 ? combined.slice(0, sepIdx) : combined.trimEnd();

  const parts: string[] = [];
  if (preamble) parts.push(preamble);
  if (body) parts.push(body);
  return parts.join("\n\n") + (parts.length ? "\n" : "");
}
