import { describe, expect, it, beforeEach } from "vitest";
import * as Blockly from "blockly/core";
import { registerAllBlocks } from "../src/blocks";
import { workspaceToPython } from "../src/codegen/pythonGen";

beforeEach(() => {
  registerAllBlocks();
});

/** Wrap a child-block spec inside an `on_setup` hat. */
function underSetup(next: object): object {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: "on_setup", next: { block: next } }],
    },
  };
}

function underLoop(inner: object): object {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: "on_loop", inputs: { DO: { block: inner } } }],
    },
  };
}

function makeWorkspace(state: object): Blockly.Workspace {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, ws);
  return ws;
}

describe("workspaceToPython", () => {
  it("emits empty output for empty workspace", () => {
    const ws = new Blockly.Workspace();
    const py = workspaceToPython(ws);
    expect(py).not.toContain("def setup():");
    expect(py).not.toContain("def loop():");
  });

  it("ignores blocks not attached to a hat", () => {
    const ws = makeWorkspace({
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "motor_start_power",
            fields: { PORT: "A" },
            inputs: { POWER: { block: { type: "math_number", fields: { NUM: 50 } } } },
          },
        ],
      },
    });
    const py = workspaceToPython(ws);
    expect(py).not.toContain("startPower");
  });

  it("wraps setup body in def setup() and adds `from hub import on`", () => {
    const ws = makeWorkspace(
      underSetup({
        type: "motor_start_power",
        fields: { PORT: "A" },
        inputs: { POWER: { block: { type: "math_number", fields: { NUM: 50 } } } },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain("from hub import on");
    expect(py).toContain("import hub, lpf2");
    expect(py).toContain("from lpf2 import devices");
    expect(py).toContain('@on("setup")');
    expect(py).toContain("def setup():");
    expect(py).toContain("    dev_a.startPower(50)");
  });

  it("wraps loop body in def loop()", () => {
    const ws = makeWorkspace(
      underLoop({ type: "hub_poweroff" }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain('@on("loop")');
    expect(py).toContain("def loop():");
    expect(py).toContain("    hub.powerOff()");
  });

  it("emits both setup and loop when both hats present", () => {
    const ws = makeWorkspace({
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: "on_setup", next: { block: { type: "hub_imu_reset" } } },
          { type: "on_loop", inputs: { DO: { block: { type: "hub_button_poll" } } } },
        ],
      },
    });
    const py = workspaceToPython(ws);
    expect(py).toContain("def setup():");
    expect(py).toContain("    hub.imu.reset()");
    expect(py).toContain("def loop():");
    expect(py).toContain("    hub.buttons.poll()");
  });

  it("dedupes device setup across multiple sensor reads in setup", () => {
    const ws = makeWorkspace(
      underSetup({
        type: "text_print",
        inputs: { TEXT: { block: { type: "distance_get", fields: { PORT: "C" } } } },
        next: {
          block: {
            type: "text_print",
            inputs: { TEXT: { block: { type: "distance_get", fields: { PORT: "C" } } } },
          },
        },
      }),
    );
    const py = workspaceToPython(ws);
    const occurrences = py.match(/dev_c = hub\.ports\.C\.device\(\)/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it("warns on port-kind collision", () => {
    const ws = makeWorkspace(
      underSetup({
        type: "text_print",
        inputs: { TEXT: { block: { type: "color_get_color", fields: { PORT: "A" } } } },
        next: {
          block: {
            type: "text_print",
            inputs: { TEXT: { block: { type: "distance_get", fields: { PORT: "A" } } } },
          },
        },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toMatch(/# WARN: port A used as color_sensor and distance_sensor/);
  });

  it("emits lpf2.color.RED for color literal block", () => {
    const ws = makeWorkspace(
      underSetup({
        type: "text_print",
        inputs: { TEXT: { block: { type: "color_literal", fields: { COLOR: "RED" } } } },
      }),
    );
    const py = workspaceToPython(ws);
    expect(py).toContain("lpf2.color.RED");
  });

  it("hat with no downstream emits empty output", () => {
    const ws = makeWorkspace({
      blocks: {
        languageVersion: 0,
        blocks: [{ type: "on_setup" }],
      },
    });
    const py = workspaceToPython(ws);
    expect(py.trim()).toBe("");
  });
});
