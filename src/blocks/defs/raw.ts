/**
 * Blocks that emit user-supplied Python verbatim. Used as the best-effort
 * carrier when converting a Python project back to Blocks — the source text
 * is stored on `block.data` and reproduced 1:1 by the generator.
 */
export const RAW_BLOCKS = [
  {
    type: "raw_python",
    message0: "raw Python code",
    previousStatement: null,
    nextStatement: null,
    colour: 290,
    tooltip: "Verbatim Python. Populated when converting a Python project to Blocks; edit the source in Python mode.",
  },
] as const;
