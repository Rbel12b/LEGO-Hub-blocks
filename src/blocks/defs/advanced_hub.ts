const VEC_AXIS = [["x", "x"], ["y", "y"], ["z", "z"]] as const;
const LOG_LEVELS = [
  ["error", "0"],
  ["warn", "1"],
  ["info", "2"],
  ["debug", "3"],
] as const;
const LCD_BACKLIGHT = [
  ["on", "on"],
  ["off", "off"],
] as const;
const PORT_DROPDOWN = [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]] as const;

/** All tagged advanced:true — revealed by the header Advanced toggle. */
export const ADVANCED_HUB_BLOCKS = [
  {
    type: "hub_imu_accel",
    message0: "accel %1 (mG)",
    args0: [{ type: "field_dropdown", name: "AXIS", options: [...VEC_AXIS] }],
    output: "Number",
    colour: 210,
    advanced: true,
  },
  {
    type: "hub_imu_gyro",
    message0: "gyro rate %1 (dps)",
    args0: [{ type: "field_dropdown", name: "AXIS", options: [...VEC_AXIS] }],
    output: "Number",
    colour: 210,
    advanced: true,
  },
  {
    type: "hub_imu_calibrated",
    message0: "IMU calibrated?",
    output: "Boolean",
    colour: 210,
    advanced: true,
  },
  {
    type: "hub_log_level",
    message0: "set log level %1",
    args0: [{ type: "field_dropdown", name: "LEVEL", options: [...LOG_LEVELS] }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    advanced: true,
  },
  {
    type: "hub_lcd_backlight",
    message0: "LCD backlight %1",
    args0: [{ type: "field_dropdown", name: "STATE", options: [...LCD_BACKLIGHT] }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    advanced: true,
  },
  {
    type: "hub_lcd_backlight_duty",
    message0: "LCD backlight duty %1",
    args0: [{ type: "input_value", name: "DUTY", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    inputsInline: true,
    advanced: true,
  },
  {
    type: "port_disable",
    message0: "disable port %1",
    args0: [{ type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    advanced: true,
    tooltip: "Disable the port's LPF2 driver so its pins can be repurposed (e.g. NeoPixel).",
  },
  {
    type: "port_enable",
    message0: "enable port %1",
    args0: [{ type: "field_dropdown", name: "PORT", options: [...PORT_DROPDOWN] }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    advanced: true,
    tooltip: "Re-enable the port's LPF2 driver after a previous disable().",
  },
  {
    type: "hub_lcd_fill",
    message0: "LCD fill RGB565 %1",
    args0: [{ type: "input_value", name: "COLOR", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    inputsInline: true,
    advanced: true,
  },
] as const;
