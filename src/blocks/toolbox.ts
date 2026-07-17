import { EVENT_BLOCKS, HUB_BLOCKS } from "./defs/hub";
import { MOTOR_BLOCKS } from "./defs/motor";
import { SENSOR_BLOCKS } from "./defs/sensor";
import { ADVANCED_HUB_BLOCKS } from "./defs/advanced_hub";
import { ADVANCED_MOTOR_BLOCKS } from "./defs/advanced_motor";
import { LVGL_BLOCKS } from "./defs/lvgl";

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
  motor_set_acc_time: { MS: 500 },
  motor_set_dec_time: { MS: 500 },
  basic_motor_power: { POWER: 50 },
  hub_lcd_backlight_duty: { DUTY: 255 },
  hub_lcd_fill: { COLOR: 0 },
  lvgl_label: { X: 10, Y: 10 },
  lvgl_rect: { X: 10, Y: 10, W: 40, H: 20 },
  lvgl_circle: { X: 40, Y: 40, D: 20 },
  lvgl_line: { X1: 0, Y1: 0, X2: 60, Y2: 40, WIDTH: 2 },
};

const STR_SHADOWS: Record<string, Record<string, string>> = {
  lvgl_label: { TEXT: "hello" },
};

const VALUE_BLOCK_SHADOWS: Record<string, Record<string, { type: string; fields?: Record<string, string | number> }>> = {
  lvgl_screen_bg: { COLOR: { type: "lvgl_hex_color", fields: { HEX: "000000" } } },
  lvgl_rect: { COLOR: { type: "lvgl_hex_color", fields: { HEX: "FF0000" } } },
  lvgl_circle: { COLOR: { type: "lvgl_hex_color", fields: { HEX: "00FF00" } } },
  lvgl_line: { COLOR: { type: "lvgl_hex_color", fields: { HEX: "FFFFFF" } } },
};

function blockWithShadows(type: string) {
  const nums = NUM_SHADOWS[type];
  const strs = STR_SHADOWS[type];
  const values = VALUE_BLOCK_SHADOWS[type];
  if (!nums && !strs && !values) return { kind: "block", type };
  const inputs: Record<string, unknown> = {};
  if (nums) for (const [name, num] of Object.entries(nums)) {
    inputs[name] = { shadow: { type: "math_number", fields: { NUM: num } } };
  }
  if (strs) for (const [name, s] of Object.entries(strs)) {
    inputs[name] = { shadow: { type: "text", fields: { TEXT: s } } };
  }
  if (values) for (const [name, def] of Object.entries(values)) {
    inputs[name] = { shadow: def };
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
  const screenCategory = showAdvanced ? [categoryOf(LVGL_BLOCKS, "Screen", "280", true)] : [];
  return {
    kind: "categoryToolbox",
    contents: [
      categoryOf(EVENT_BLOCKS, "Events", "45", showAdvanced),
      categoryOf([...HUB_BLOCKS, ...ADVANCED_HUB_BLOCKS], "Hub", "210", showAdvanced),
      categoryOf([...MOTOR_BLOCKS, ...ADVANCED_MOTOR_BLOCKS], "Motor", "160", showAdvanced),
      categoryOf(SENSOR_BLOCKS, "Sensor", "260", showAdvanced),
      ...screenCategory,
      { kind: "sep" },
      ...STANDARD_CATEGORIES,
    ],
  };
}
