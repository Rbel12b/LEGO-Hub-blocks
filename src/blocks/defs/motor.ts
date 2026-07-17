import { PORT_DROPDOWN } from "./hub";

export const MOTOR_BLOCKS = [
  {
    type: "motor_start_speed",
    message0: "motor %1 start at speed %2",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "SPEED", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
  },
  {
    type: "motor_start_power",
    message0: "motor %1 start at power %2",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "POWER", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
  },
  {
    type: "motor_stop",
    message0: "motor %1 stop",
    args0: [{ type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] }],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
  },
  {
    type: "motor_run_for_time",
    message0: "motor %1 run for %2 ms at speed %3",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "MS", check: "Number" },
      { type: "input_value", name: "SPEED", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
  },
  {
    type: "motor_run_for_degrees",
    message0: "motor %1 run %2 degrees at speed %3",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "DEG", check: "Number" },
      { type: "input_value", name: "SPEED", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
  },
  {
    type: "motor_goto_position",
    message0: "motor %1 go to position %2 at speed %3",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "DEG", check: "Number" },
      { type: "input_value", name: "SPEED", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
  },
  {
    type: "motor_reset_encoder",
    message0: "motor %1 reset encoder",
    args0: [{ type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] }],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
  },
] as const;
