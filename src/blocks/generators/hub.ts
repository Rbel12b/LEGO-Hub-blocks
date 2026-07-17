import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { needsLpf2 } from "../setup";

export function registerHubGenerators(gen: PythonGenerator): void {
  gen.forBlock["on_program_start"] = () => "";

  gen.forBlock["hub_led_color"] = (block: Block) => {
    needsLpf2(gen);
    const color = block.getFieldValue("COLOR");
    return `hub.ports.LED.setRgbColorIdx(lpf2.color.${color})\n`;
  };

  gen.forBlock["hub_led_rgb"] = (block: Block) => {
    needsLpf2(gen);
    const r = gen.valueToCode(block, "R", Order.NONE) || "0";
    const g = gen.valueToCode(block, "G", Order.NONE) || "0";
    const b = gen.valueToCode(block, "B", Order.NONE) || "0";
    return `hub.ports.LED.setRgbColor(${r}, ${g}, ${b})\n`;
  };

  gen.forBlock["hub_button_pressed"] = (block: Block) => {
    needsLpf2(gen);
    const btn = block.getFieldValue("BTN");
    return [`hub.buttons.${btn}()`, Order.FUNCTION_CALL];
  };

  gen.forBlock["hub_button_poll"] = () => {
    needsLpf2(gen);
    return "hub.buttons.poll()\n";
  };

  gen.forBlock["hub_imu_axis"] = (block: Block) => {
    needsLpf2(gen);
    const axis = block.getFieldValue("AXIS");
    return [`hub.imu.${axis}`, Order.MEMBER];
  };

  gen.forBlock["hub_imu_reset"] = () => {
    needsLpf2(gen);
    return "hub.imu.reset()\n";
  };

  gen.forBlock["hub_poweroff"] = () => {
    needsLpf2(gen);
    return "hub.powerOff()\n";
  };

  gen.forBlock["color_literal"] = (block: Block) => {
    needsLpf2(gen);
    const color = block.getFieldValue("COLOR");
    return [`lpf2.color.${color}`, Order.MEMBER];
  };
}
