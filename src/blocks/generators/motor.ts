import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { type Port, registerDevice } from "../setup";

export function registerMotorGenerators(gen: PythonGenerator): void {
  const port = (block: Block) => block.getFieldValue("PORT") as Port;
  const val = (block: Block, name: string, def = "0") =>
    gen.valueToCode(block, name, Order.NONE) || def;
  const setup = (block: Block) => {
    const p = port(block);
    return { v: registerDevice(gen, p, "motor"), p };
  };

  gen.forBlock["motor_start_speed"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.startSpeed(${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_start_power"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.startPower(${val(block, "POWER")})\n`;
  };

  gen.forBlock["motor_stop"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.startPower(0)\n`;
  };

  gen.forBlock["motor_run_for_time"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.startSpeedForTime(${val(block, "MS")}, ${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_run_for_degrees"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.startSpeedForDegrees(${val(block, "DEG")}, ${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_goto_position"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.gotoAbsPosition(${val(block, "DEG")}, ${val(block, "SPEED")})\n`;
  };

  gen.forBlock["motor_reset_encoder"] = (block: Block) => {
    const { v } = setup(block);
    return `${v}.presetEncoder(0)\n`;
  };
}
