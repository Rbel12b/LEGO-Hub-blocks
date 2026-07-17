import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { needsLpf2 } from "../setup";

export function registerAdvancedMotorGenerators(gen: PythonGenerator): void {
  const port = (block: Block) => block.getFieldValue("PORT");
  const val = (block: Block, name: string, def = "0") =>
    gen.valueToCode(block, name, Order.NONE) || def;

  gen.forBlock["motor_set_acc_time"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.setAccTime(${val(block, "MS", "500")}, ${block.getFieldValue("PROFILE")})\n`;
  };

  gen.forBlock["motor_set_dec_time"] = (block: Block) => {
    needsLpf2(gen);
    return `hub.ports.${port(block)}.setDecTime(${val(block, "MS", "500")}, ${block.getFieldValue("PROFILE")})\n`;
  };

  gen.forBlock["basic_motor_power"] = (block: Block) => {
    needsLpf2(gen);
    // basic_motor exposes only startPower; direct-port method works too.
    return `hub.ports.${port(block)}.startPower(${val(block, "POWER", "50")})\n`;
  };

  gen.forBlock["motor_get_position"] = (block: Block) => {
    needsLpf2(gen);
    return [`hub.ports.${port(block)}.getValue(2, 0)`, Order.FUNCTION_CALL];
  };

  gen.forBlock["motor_get_speed"] = (block: Block) => {
    needsLpf2(gen);
    return [`hub.ports.${port(block)}.getValue(1, 0)`, Order.FUNCTION_CALL];
  };
}
