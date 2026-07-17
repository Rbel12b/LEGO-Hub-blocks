export const PORT_DROPDOWN = [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]] as const;

export const COLOR_OPTIONS = [
  ["black", "BLACK"],
  ["pink", "PINK"],
  ["purple", "PURPLE"],
  ["blue", "BLUE"],
  ["light blue", "LIGHTBLUE"],
  ["cyan", "CYAN"],
  ["green", "GREEN"],
  ["yellow", "YELLOW"],
  ["orange", "ORANGE"],
  ["red", "RED"],
  ["white", "WHITE"],
  ["none", "NONE"],
] as const;

export const BUTTON_OPTIONS = [
  ["center", "center"],
  ["up", "up"],
  ["down", "down"],
  ["left", "left"],
  ["right", "right"],
] as const;

export const IMU_AXIS = [
  ["pitch", "pitch"],
  ["yaw", "yaw"],
  ["roll", "roll"],
] as const;

export const HUB_BLOCKS = [
  {
    type: "hub_led_color",
    message0: "set hub LED to %1",
    args0: [{ type: "field_dropdown", name: "COLOR", options: [...COLOR_OPTIONS] }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: "Set the hub's built-in LED to a named color.",
  },
  {
    type: "hub_led_rgb",
    message0: "set hub LED red %1 green %2 blue %3",
    args0: [
      { type: "input_value", name: "R", check: "Number" },
      { type: "input_value", name: "G", check: "Number" },
      { type: "input_value", name: "B", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    inputsInline: true,
  },
  {
    type: "hub_button_pressed",
    message0: "button %1 pressed?",
    args0: [{ type: "field_dropdown", name: "BTN", options: [...BUTTON_OPTIONS] }],
    output: "Boolean",
    colour: 210,
  },
  {
    type: "hub_button_poll",
    message0: "poll hub buttons",
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: "hub_imu_axis",
    message0: "IMU %1",
    args0: [{ type: "field_dropdown", name: "AXIS", options: [...IMU_AXIS] }],
    output: "Number",
    colour: 210,
  },
  {
    type: "hub_imu_reset",
    message0: "reset IMU",
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: "hub_poweroff",
    message0: "power off hub",
    previousStatement: null,
    nextStatement: null,
    colour: 0,
  },
  {
    type: "color_literal",
    message0: "color %1",
    args0: [{ type: "field_dropdown", name: "COLOR", options: [...COLOR_OPTIONS] }],
    output: "Number",
    colour: 20,
  },
] as const;
