import type { PythonGenerator } from "blockly/python";
import { needsLpf2 } from "../setup";

const LOOP_BLOCKS = [
  "controls_whileUntil",
  "controls_repeat",
  "controls_repeat_ext",
  "controls_for",
  "controls_forEach",
];

/** Matches `hub.sleep(...)`, `hub.sleep_ms(...)`. */
const SLEEP_RE = /\bhub\.sleep(?:_ms|_us)?\s*\(/;

/**
 * Wrap Blockly's stock loop generators so each iteration yields to the hub
 * runtime (button/event polling). If body's top-level path already contains a
 * sleep call, leave it alone — that call already yields. Otherwise append
 * `hub.sleep_ms(0)` and strip any stray `pass` (Blockly emits `pass` when body
 * is empty).
 */
export function registerLoopSleepOverrides(gen: PythonGenerator): void {
  for (const type of LOOP_BLOCKS) {
    const orig = gen.forBlock[type];
    if (!orig) continue;
    gen.forBlock[type] = function (block, generator) {
      const g = generator ?? gen;
      const result = orig.call(this, block, g);
      const code = Array.isArray(result) ? result[0] : result;
      if (typeof code !== "string" || !code) return result;

      const indent = g.INDENT;
      const lines = code.replace(/\n+$/, "").split("\n");
      const bodyStart = lines.findIndex((l) => l.startsWith(indent));
      if (bodyStart < 0) return result;

      const header = lines.slice(0, bodyStart);
      const body = lines.slice(bodyStart);
      const isTopLevel = (l: string) => l.startsWith(indent) && !l.startsWith(indent + indent);
      const hasSleep = body.some((l) => isTopLevel(l) && SLEEP_RE.test(l));

      let newBody = body;
      if (!hasSleep) {
        newBody = body.filter((l) => !(isTopLevel(l) && l.trim() === "pass"));
        newBody.push(`${indent}hub.sleep_ms(0)`);
        needsLpf2(g);
      }

      return [...header, ...newBody].join("\n") + "\n";
    };
  }
}
