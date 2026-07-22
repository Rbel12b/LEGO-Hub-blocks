import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { type Port, registerDevice } from "../setup";

export function registerAdvancedMotorGenerators(gen: PythonGenerator): void {
  const port = (block: Block) => block.getFieldValue("PORT") as Port;
  const val = (block: Block, name: string, def = "0") =>
    gen.valueToCode(block, name, Order.NONE) || def;

  gen.forBlock["motor_set_acc_time"] = (block: Block) => {
    const v = registerDevice(gen, port(block), "motor");
    return `${v}.setAccTime(${val(block, "MS", "500")}, ${block.getFieldValue("PROFILE")})\n`;
  };

  gen.forBlock["motor_set_dec_time"] = (block: Block) => {
    const v = registerDevice(gen, port(block), "motor");
    return `${v}.setDecTime(${val(block, "MS", "500")}, ${block.getFieldValue("PROFILE")})\n`;
  };

  gen.forBlock["basic_motor_power"] = (block: Block) => {
    const v = registerDevice(gen, port(block), "basic_motor");
    return `${v}.startPower(${val(block, "POWER", "50")})\n`;
  };

  gen.forBlock["motor_get_position"] = (block: Block) => {
    const v = registerDevice(gen, port(block), "motor");
    return [`${v}.getValue(2, 0)`, Order.FUNCTION_CALL];
  };

  gen.forBlock["motor_get_speed"] = (block: Block) => {
    const v = registerDevice(gen, port(block), "motor");
    return [`${v}.getValue(1, 0)`, Order.FUNCTION_CALL];
  };
}
