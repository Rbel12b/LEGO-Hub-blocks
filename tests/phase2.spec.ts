import { describe, expect, it, beforeEach } from "vitest";
import * as Blockly from "blockly/core";
import { registerAllBlocks } from "../src/blocks";
import { workspaceToPython } from "../src/codegen/pythonGen";

beforeEach(() => registerAllBlocks());

function underHat(next: object): object {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: "on_program_start", next: { block: next } }],
    },
  };
}

function makeWorkspace(state: object): Blockly.Workspace {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, ws);
  return ws;
}

describe("Phase 2 blocks", () => {
  it("emits hub.imu.acceleration.x", () => {
    const ws = makeWorkspace(
      underHat({
        type: "text_print",
        inputs: { TEXT: { block: { type: "hub_imu_accel", fields: { AXIS: "x" } } } },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain("hub.imu.acceleration.x");
  });

  it("emits hub.log.setLevel(1)", () => {
    const ws = makeWorkspace(underHat({ type: "hub_log_level", fields: { LEVEL: "1" } }));
    const py = workspaceToPython(ws);
    expect(py).toContain("hub.log.setLevel(1)");
  });

  it("emits LCD backlight on", () => {
    const ws = makeWorkspace(underHat({ type: "hub_lcd_backlight", fields: { STATE: "on" } }));
    const py = workspaceToPython(ws);
    expect(py).toContain("hub.lcd.on()");
  });

  it("emits motor setAccTime with profile", () => {
    const ws = makeWorkspace(
      underHat({
        type: "motor_set_acc_time",
        fields: { PORT: "A", PROFILE: "1" },
        inputs: { MS: { block: { type: "math_number", fields: { NUM: 500 } } } },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain("hub.ports.A.setAccTime(500, 1)");
  });

  it("emits basic_motor_power via direct-port startPower", () => {
    const ws = makeWorkspace(
      underHat({
        type: "basic_motor_power",
        fields: { PORT: "B" },
        inputs: { POWER: { block: { type: "math_number", fields: { NUM: 75 } } } },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain("hub.ports.B.startPower(75)");
  });

  it("LVGL setup includes import and screen_active", () => {
    const ws = makeWorkspace(underHat({ type: "lvgl_clear_screen" }));
    const py = workspaceToPython(ws);
    expect(py).toContain("import lvgl as lv");
    expect(py).toContain("_scr = lv.screen_active()");
    expect(py).toContain("_scr.clean()");
  });

  it("LVGL label emits create + set_text + set_pos", () => {
    const ws = makeWorkspace(
      underHat({
        type: "lvgl_label",
        inputs: {
          TEXT: { block: { type: "text", fields: { TEXT: "hi" } } },
          X: { block: { type: "math_number", fields: { NUM: 10 } } },
          Y: { block: { type: "math_number", fields: { NUM: 20 } } },
        },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toMatch(/_lbl_\w+ = lv\.label\(_scr\)/);
    expect(py).toContain(`.set_text('hi')`);
    expect(py).toContain(`.set_pos(10, 20)`);
  });

  it("LVGL button emits event callback with body + add_event_cb", () => {
    const ws = makeWorkspace(
      underHat({
        type: "lvgl_button",
        inputs: {
          TEXT: { block: { type: "text", fields: { TEXT: "OK" } } },
          X: { block: { type: "math_number", fields: { NUM: 0 } } },
          Y: { block: { type: "math_number", fields: { NUM: 0 } } },
          W: { block: { type: "math_number", fields: { NUM: 80 } } },
          H: { block: { type: "math_number", fields: { NUM: 30 } } },
          WHEN_CLICKED: { block: { type: "hub_poweroff" } },
        },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toMatch(/def _btn_\w+_cb\(e\):/);
    expect(py).toContain("hub.powerOff()");
    expect(py).toMatch(/lv\.button\(_scr\)/);
    expect(py).toMatch(/\.add_event_cb\(_btn_\w+_cb, lv\.EVENT\.CLICKED, None\)/);
  });

  it("lvgl_run emits task_handler loop + import time", () => {
    const ws = makeWorkspace(underHat({ type: "lvgl_run" }));
    const py = workspaceToPython(ws);
    expect(py).toContain("import time");
    expect(py).toContain("lv.task_handler()");
    expect(py).toContain("time.sleep_ms(5)");
  });

  it("lvgl_hex_color normalizes hex", () => {
    const ws = makeWorkspace(
      underHat({
        type: "lvgl_screen_bg",
        inputs: {
          COLOR: { block: { type: "lvgl_hex_color", fields: { HEX: "ff0080" } } },
        },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain("lv.color_hex(0xFF0080)");
  });
});
