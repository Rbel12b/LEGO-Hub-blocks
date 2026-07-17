import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { needsLpf2 } from "../setup";

export function registerAdvancedHubGenerators(gen: PythonGenerator): void {
  const val = (block: Block, name: string, def = "0") =>
    gen.valueToCode(block, name, Order.NONE) || def;

  gen.forBlock["hub_imu_accel"] = (block: Block) => {
    needsLpf2(gen);
    return [`hub.imu.acceleration.${block.getFieldValue("AXIS")}`, Order.MEMBER];
  };

  gen.forBlock["hub_imu_gyro"] = (block: Block) => {
    needsLpf2(gen);
    return [`hub.imu.gyro_rate.${block.getFieldValue("AXIS")}`, Order.MEMBER];
  };

  gen.forBlock["hub_imu_calibrated"] = () => {
    needsLpf2(gen);
    return [`hub.imu.calibrated`, Order.MEMBER];
  };

  gen.forBlock["hub_log_level"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.log.setLevel(${block.getFieldValue("LEVEL")})\n`;
  };

  gen.forBlock["hub_lcd_backlight"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.lcd.${block.getFieldValue("STATE")}()\n`;
  };

  gen.forBlock["hub_lcd_backlight_duty"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.lcd.backlight(${val(block, "DUTY", "255")})\n`;
  };

  gen.forBlock["hub_lcd_fill"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.lcd.fill(${val(block, "COLOR", "0")})\n`;
  };
}
