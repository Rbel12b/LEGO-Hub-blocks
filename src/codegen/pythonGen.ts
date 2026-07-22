import type { Block, Workspace } from "blockly";
import { pythonGenerator } from "blockly/python";
import { registerAllBlocks } from "../blocks";
import { resetSetup } from "../blocks/setup";

registerAllBlocks();

const DEFS_SEPARATOR = "\n\n\n";
const HAT_TYPE = "on_program_start";
const PROC_TYPES = new Set(["procedures_defnoreturn", "procedures_defreturn"]);

/**
 * Emit Python for a workspace. Stacks under `on_program_start` hats run at
 * module top-level; procedure definitions become top-level `def`s via
 * Blockly's normal definitions_ machinery. Orphan blocks are ignored.
 */
export function workspaceToPython(workspace: Workspace): string {
  resetSetup();
  const gen = pythonGenerator;
  gen.init(workspace);

  // Emit procedure definitions (their generators populate definitions_).
  for (const top of workspace.getTopBlocks(true)) {
    if (PROC_TYPES.has(top.type)) gen.blockToCode(top);
  }

  const chunks: string[] = [];
  for (const top of workspace.getTopBlocks(true)) {
    if (top.type !== HAT_TYPE) continue;
    const next: Block | null = top.getNextBlock();
    if (!next) continue;
    const code = gen.blockToCode(next);
    const text = Array.isArray(code) ? code[0] : code;
    if (text) chunks.push(text);
  }

  const body = chunks.join("").replace(/\s+$/, "");
  const combined = gen.finish("");
  (gen as unknown as { definitions_: Record<string, string> }).definitions_ = {};

  const sepIdx = combined.indexOf(DEFS_SEPARATOR);
  const preamble = sepIdx >= 0 ? combined.slice(0, sepIdx) : combined.trimEnd();

  const parts: string[] = [];
  if (preamble) parts.push(preamble);
  if (body) parts.push(body);
  return parts.join("\n\n") + (parts.length ? "\n" : "");
}
