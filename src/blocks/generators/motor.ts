import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { needsLpf2 } from "../setup";

export function registerMotorGenerators(gen: PythonGenerator): void {
  const port = (block: Block) => block.getFieldValue("PORT");
  const val = (block: Block, name: string, def = "0") =>
    gen.valueToCode(block, name, Order.NONE) || def;

  gen.forBlock["motor_start_speed"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.startSpeed(${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_start_power"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.startPower(${val(block, "POWER")})\n`;
  };

  gen.forBlock["motor_stop"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.startPower(0)\n`;
  };

  gen.forBlock["motor_run_for_time"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.startSpeedForTime(${val(block, "MS")}, ${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_run_for_degrees"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.startSpeedForDegrees(${val(block, "DEG")}, ${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_goto_position"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.gotoAbsPosition(${val(block, "DEG")}, ${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_reset_encoder"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.presetEncoder(0)\n`;
  };
}
