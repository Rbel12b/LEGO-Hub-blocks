import { EVENT_BLOCKS, HUB_BLOCKS } from "./defs/hub";
import { MOTOR_BLOCKS } from "./defs/motor";
import { SENSOR_BLOCKS } from "./defs/sensor";

interface ToolboxDef {
  advanced?: boolean;
  type: string;
}

/**
 * Default number shadows per (blockType, inputName). When the block is dragged
 * from the flyout, these prefill as light-gray "shadow" number fields — user
 * can type over them, or drop a reporter block which replaces the shadow.
 */
const NUM_SHADOWS: Record<string, Record<string, number>> = {
  hub_led_rgb: { R: 255, G: 255, B: 255 },
  motor_start_speed: { SPEED: 50 },
  motor_start_power: { POWER: 50 },
  motor_run_for_time: { MS: 1000, SPEED: 50 },
  motor_run_for_degrees: { DEG: 360, SPEED: 50 },
  motor_goto_position: { DEG: 0, SPEED: 50 },
  color_set_light: { L1: 100, L2: 100, L3: 100 },
  distance_set_light: { L1: 100, L2: 100, L3: 100, L4: 100 },
};

function blockWithShadows(type: string) {
  const shadows = NUM_SHADOWS[type];
  if (!shadows) return { kind: "block", type };
  const inputs: Record<string, unknown> = {};
  for (const [name, num] of Object.entries(shadows)) {
    inputs[name] = { shadow: { type: "math_number", fields: { NUM: num } } };
  }
  return { kind: "block", type, inputs };
}

const STANDARD_CATEGORIES = [
  {
    kind: "category",
    name: "Logic",
    colour: "210",
    contents: [
      { kind: "block", type: "controls_if" },
      {
        kind: "block",
        type: "logic_compare",
        inputs: {
          A: { shadow: { type: "math_number", fields: { NUM: 0 } } },
          B: { shadow: { type: "math_number", fields: { NUM: 0 } } },
        },
      },
      { kind: "block", type: "logic_operation" },
      { kind: "block", type: "logic_negate" },
      { kind: "block", type: "logic_boolean" },
    ],
  },
  {
    kind: "category",
    name: "Loops",
    colour: "120",
    contents: [
      {
        kind: "block",
        type: "controls_repeat_ext",
        inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } } },
      },
      { kind: "block", type: "controls_whileUntil" },
      {
        kind: "block",
        type: "controls_for",
        inputs: {
          FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
          TO: { shadow: { type: "math_number", fields: { NUM: 10 } } },
          BY: { shadow: { type: "math_number", fields: { NUM: 1 } } },
        },
      },
    ],
  },
  {
    kind: "category",
    name: "Math",
    colour: "230",
    contents: [
      { kind: "block", type: "math_number" },
      {
        kind: "block",
        type: "math_arithmetic",
        inputs: {
          A: { shadow: { type: "math_number", fields: { NUM: 1 } } },
          B: { shadow: { type: "math_number", fields: { NUM: 1 } } },
        },
      },
      {
        kind: "block",
        type: "math_single",
        inputs: { NUM: { shadow: { type: "math_number", fields: { NUM: 9 } } } },
      },
      {
        kind: "block",
        type: "math_modulo",
        inputs: {
          DIVIDEND: { shadow: { type: "math_number", fields: { NUM: 64 } } },
          DIVISOR: { shadow: { type: "math_number", fields: { NUM: 10 } } },
        },
      },
      {
        kind: "block",
        type: "math_random_int",
        inputs: {
          FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
          TO: { shadow: { type: "math_number", fields: { NUM: 100 } } },
        },
      },
    ],
  },
  {
    kind: "category",
    name: "Text",
    colour: "160",
    contents: [
      { kind: "block", type: "text" },
      {
        kind: "block",
        type: "text_print",
        inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "hello" } } } },
      },
      { kind: "block", type: "text_length" },
    ],
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
    .map((d) => blockWithShadows(d.type));
  return { kind: "category", name, colour, contents };
}

export function buildToolbox(showAdvanced: boolean) {
  return {
    kind: "categoryToolbox",
    contents: [
      categoryOf(EVENT_BLOCKS, "Events", "45", showAdvanced),
      categoryOf(HUB_BLOCKS, "Hub", "210", showAdvanced),
      categoryOf(MOTOR_BLOCKS, "Motor", "160", showAdvanced),
      categoryOf(SENSOR_BLOCKS, "Sensor", "260", showAdvanced),
      { kind: "sep" },
      ...STANDARD_CATEGORIES,
    ],
  };
}
