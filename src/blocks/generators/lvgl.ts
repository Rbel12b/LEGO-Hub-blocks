import type { Block } from "blockly";
import { Order, type PythonGenerator } from "blockly/python";
import { needsLvgl, needsTime } from "../setup";

/** Unique-per-block symbol so multiple widgets can coexist. */
function widgetVar(prefix: string, block: Block): string {
  // Blockly IDs contain chars like `!`; sanitize to identifier-safe form.
  const safe = block.id.replace(/[^A-Za-z0-9]/g, "_").slice(0, 10);
  return `_${prefix}_${safe}`;
}

export function registerLvglGenerators(gen: PythonGenerator): void {
  const val = (block: Block, name: string, def = "0") =>
    gen.valueToCode(block, name, Order.NONE) || def;

  gen.forBlock["lvgl_screen_bg"] = (block: Block) => {
    needsLvgl(gen);
    return `_scr.set_style_bg_color(lv.color_hex(${val(block, "COLOR", "0x000000")}), 0)\n`;
  };

  gen.forBlock["lvgl_clear_screen"] = () => {
    needsLvgl(gen);
    return `_scr.clean()\n`;
  };

  gen.forBlock["lvgl_label"] = (block: Block) => {
    needsLvgl(gen);
    const v = widgetVar("lbl", block);
    return [
      `${v} = lv.label(_scr)`,
      `${v}.set_text(${val(block, "TEXT", '""')})`,
      `${v}.set_pos(${val(block, "X", "0")}, ${val(block, "Y", "0")})`,
      ``,
    ].join("\n");
  };

  gen.forBlock["lvgl_button"] = (block: Block) => {
    needsLvgl(gen);
    const btn = widgetVar("btn", block);
    const lbl = `${btn}_lbl`;
    const cb = `${btn}_cb`;
    const body = gen.statementToCode(block, "WHEN_CLICKED") || "    pass\n";
    // statementToCode already indents 4 spaces; wrap under def.
    return [
      `def ${cb}(e):`,
      body,
      `${btn} = lv.button(_scr)`,
      `${btn}.set_pos(${val(block, "X", "0")}, ${val(block, "Y", "0")})`,
      `${btn}.set_size(${val(block, "W", "80")}, ${val(block, "H", "30")})`,
      `${lbl} = lv.label(${btn})`,
      `${lbl}.set_text(${val(block, "TEXT", '""')})`,
      `${lbl}.center()`,
      `${btn}.add_event_cb(${cb}, lv.EVENT.CLICKED, None)`,
      ``,
    ].join("\n");
  };

  gen.forBlock["lvgl_run"] = () => {
    needsLvgl(gen);
    needsTime(gen);
    return [
      `while True:`,
      `    lv.task_handler()`,
      `    time.sleep_ms(5)`,
      ``,
    ].join("\n");
  };

  gen.forBlock["lvgl_hex_color"] = (block: Block) => {
    const hex = block.getFieldValue("HEX").replace(/^#/, "").replace(/^0x/i, "");
    const n = parseInt(hex, 16);
    return [`0x${(isNaN(n) ? 0 : n).toString(16).padStart(6, "0").toUpperCase()}`, Order.ATOMIC];
  };
}
