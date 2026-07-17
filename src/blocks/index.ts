import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import "blockly/blocks";
import { pythonGenerator } from "blockly/python";
import { EVENT_BLOCKS, HUB_BLOCKS } from "./defs/hub";
import { MOTOR_BLOCKS } from "./defs/motor";
import { SENSOR_BLOCKS } from "./defs/sensor";
import { ADVANCED_HUB_BLOCKS } from "./defs/advanced_hub";
import { ADVANCED_MOTOR_BLOCKS } from "./defs/advanced_motor";
import { LVGL_BLOCKS } from "./defs/lvgl";
import { registerHubGenerators } from "./generators/hub";
import { registerMotorGenerators } from "./generators/motor";
import { registerSensorGenerators } from "./generators/sensor";
import { registerAdvancedHubGenerators } from "./generators/advanced_hub";
import { registerAdvancedMotorGenerators } from "./generators/advanced_motor";
import { registerLvglGenerators } from "./generators/lvgl";

let registered = false;

/** Register all custom block defs + Python generators. Idempotent. */
export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  Blockly.setLocale(En as unknown as { [key: string]: string });
  const defs = [
    ...EVENT_BLOCKS,
    ...HUB_BLOCKS,
    ...MOTOR_BLOCKS,
    ...SENSOR_BLOCKS,
    ...ADVANCED_HUB_BLOCKS,
    ...ADVANCED_MOTOR_BLOCKS,
    ...LVGL_BLOCKS,
  ];
  Blockly.defineBlocksWithJsonArray(defs as unknown as object[]);
  registerHubGenerators(pythonGenerator);
  registerMotorGenerators(pythonGenerator);
  registerSensorGenerators(pythonGenerator);
  registerAdvancedHubGenerators(pythonGenerator);
  registerAdvancedMotorGenerators(pythonGenerator);
  registerLvglGenerators(pythonGenerator);
}

export { pythonGenerator };
