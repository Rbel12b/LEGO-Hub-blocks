import { HUB_BLOCKS } from "./defs/hub";
import { MOTOR_BLOCKS } from "./defs/motor";
import { SENSOR_BLOCKS } from "./defs/sensor";

interface ToolboxDef {
  advanced?: boolean;
  type: string;
}

const STANDARD_CATEGORIES = [
  {
    kind: "category",
    name: "Logic",
    colour: "210",
    contents: ["controls_if", "logic_compare", "logic_operation", "logic_negate", "logic_boolean"].map(
      (t) => ({ kind: "block", type: t }),
    ),
  },
  {
    kind: "category",
    name: "Loops",
    colour: "120",
    contents: ["controls_repeat_ext", "controls_whileUntil", "controls_for"].map((t) => ({ kind: "block", type: t })),
  },
  {
    kind: "category",
    name: "Math",
    colour: "230",
    contents: ["math_number", "math_arithmetic", "math_single", "math_modulo", "math_random_int"].map((t) => ({
      kind: "block",
      type: t,
    })),
  },
  {
    kind: "category",
    name: "Text",
    colour: "160",
    contents: ["text", "text_print", "text_length"].map((t) => ({ kind: "block", type: t })),
  },
  {
    kind: "category",
    name: "Lists",
    colour: "260",
    contents: ["lists_create_with", "lists_length", "lists_getIndex"].map((t) => ({ kind: "block", type: t })),
  },
  { kind: "category", name: "Variables", colour: "330", custom: "VARIABLE" },
  { kind: "category", name: "Functions", colour: "290", custom: "PROCEDURE" },
];

function categoryOf(defs: readonly ToolboxDef[], name: string, colour: string, showAdvanced: boolean) {
  const contents = defs
    .filter((d) => showAdvanced || !d.advanced)
    .map((d) => ({ kind: "block", type: d.type }));
  return { kind: "category", name, colour, contents };
}

export function buildToolbox(showAdvanced: boolean) {
  return {
    kind: "categoryToolbox",
    contents: [
      categoryOf(HUB_BLOCKS, "Hub", "210", showAdvanced),
      categoryOf(MOTOR_BLOCKS, "Motor", "160", showAdvanced),
      categoryOf(SENSOR_BLOCKS, "Sensor", "260", showAdvanced),
      { kind: "sep" },
      ...STANDARD_CATEGORIES,
    ],
  };
}
