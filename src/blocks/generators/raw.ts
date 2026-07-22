import type { Block } from "blockly";
import type { PythonGenerator } from "blockly/python";

export function registerRawGenerators(gen: PythonGenerator): void {
  gen.forBlock["raw_python"] = (block: Block) => {
    const code = (block.data as string | undefined) ?? "";
    if (!code) return "";
    return code.endsWith("\n") ? code : code + "\n";
  };
}
