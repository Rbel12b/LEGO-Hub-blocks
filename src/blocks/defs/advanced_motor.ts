import { PORT_DROPDOWN } from "./hub";

const ACCEL_PROFILE = [
  ["gentle", "0"],
  ["fast", "1"],
] as const;

export const ADVANCED_MOTOR_BLOCKS = [
  {
    type: "motor_set_acc_time",
    message0: "motor %1 acceleration time %2 ms profile %3",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "MS", check: "Number" },
      { type: "field_dropdown", name: "PROFILE", options: [...ACCEL_PROFILE] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
    advanced: true,
  },
  {
    type: "motor_set_dec_time",
    message0: "motor %1 deceleration time %2 ms profile %3",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "MS", check: "Number" },
      { type: "field_dropdown", name: "PROFILE", options: [...ACCEL_PROFILE] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
    advanced: true,
  },
  {
    type: "basic_motor_power",
    message0: "basic motor %1 power %2",
    args0: [
      { type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] },
      { type: "input_value", name: "POWER", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    inputsInline: true,
    advanced: true,
    tooltip: "For unencoded motors (train motor, plain DC). Power only.",
  },
  {
    type: "motor_get_position",
    message0: "motor %1 position",
    args0: [{ type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] }],
    output: "Number",
    colour: 160,
    advanced: true,
  },
  {
    type: "motor_get_speed",
    message0: "motor %1 speed",
    args0: [{ type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] }],
    output: "Number",
    colour: 160,
    advanced: true,
  },
] as const;
