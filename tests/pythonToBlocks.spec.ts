import { describe, expect, it, beforeEach } from "vitest";
import * as Blockly from "blockly/core";
import { registerAllBlocks } from "../src/blocks";
import { workspaceToPython } from "../src/codegen/pythonGen";
import { pythonToBlocks, type BlockSpec } from "../src/project/pythonToBlocks";

beforeEach(() => registerAllBlocks());

function underHat(chain: BlockSpec | undefined): object {
  const hat: Record<string, unknown> = { type: "on_program_start" };
  if (chain) hat.next = { block: chain };
  return { blocks: { languageVersion: 0, blocks: [hat] } };
}

function makeWorkspace(state: object): Blockly.Workspace {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, ws);
  return ws;
}

/** Collect block types along the `.next` chain. */
function chainTypes(spec: BlockSpec | undefined): string[] {
  const out: string[] = [];
  let cur: BlockSpec | undefined = spec;
  while (cur) {
    out.push(cur.type);
    cur = cur.next?.block;
  }
  return out;
}

/** Round-trip: workspace → python → blocks → python. Both python outputs
 *  should be identical for pure hub/motor/sensor content (no ID-dependent
 *  LVGL widget names). */
function roundTrip(chain: BlockSpec): { first: string; second: string } {
  const ws1 = makeWorkspace(underHat(chain));
  const first = workspaceToPython(ws1);
  const converted = pythonToBlocks(first);
  const ws2 = makeWorkspace(underHat(converted));
  const second = workspaceToPython(ws2);
  return { first, second };
}

describe("pythonToBlocks", () => {
  it("returns undefined for empty source", () => {
    expect(pythonToBlocks("")).toBeUndefined();
    expect(pythonToBlocks("\n\n\n")).toBeUndefined();
  });

  it("skips import preamble", () => {
    const chain = pythonToBlocks("import hub, lpf2\nfrom lpf2 import devices\n");
    expect(chain).toBeUndefined();
  });

  it("recognizes hub_led_color", () => {
    const src = "import hub, lpf2\n\nhub.ports.LED.setRgbColorIdx(lpf2.color.RED)\n";
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("hub_led_color");
    expect(chain?.fields?.COLOR).toBe("RED");
  });

  it("recognizes hub_led_rgb with numeric literals", () => {
    const src = "hub.ports.LED.setRgbColor(10, 20, 30)\n";
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("hub_led_rgb");
    expect(chain?.inputs?.R.shadow?.fields?.NUM).toBe("10");
    expect(chain?.inputs?.G.shadow?.fields?.NUM).toBe("20");
    expect(chain?.inputs?.B.shadow?.fields?.NUM).toBe("30");
  });

  it("recognizes bare hub statement blocks", () => {
    const src = "hub.buttons.poll()\nhub.imu.reset()\nhub.powerOff()\n";
    expect(chainTypes(pythonToBlocks(src))).toEqual(["hub_button_poll", "hub_imu_reset", "hub_poweroff"]);
  });

  it("wraps unknown code in a raw_python block", () => {
    const src = "some_var = compute()\nprint('hi')\n";
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("raw_python");
    expect(chain?.data).toBe("some_var = compute()\nprint('hi')");
  });

  it("intersperses raw blocks between recognized ones", () => {
    const src = [
      "hub.buttons.poll()",
      "print('mid')",
      "hub.imu.reset()",
      "",
    ].join("\n");
    const types = chainTypes(pythonToBlocks(src));
    expect(types).toEqual(["hub_button_poll", "raw_python", "hub_imu_reset"]);
  });

  it("preserves indented control-flow verbatim in raw block", () => {
    const src = "for i in range(3):\n    print(i)\n";
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("raw_python");
    expect(chain?.data).toBe("for i in range(3):\n    print(i)");
  });

  it("recognizes motor block after typed-device setup", () => {
    const src = [
      "import hub, lpf2",
      "from lpf2 import devices",
      "dev_a = hub.ports.A.device()",
      "if not isinstance(dev_a, devices.motor):",
      '    raise TypeError("Port A: expected motor")',
      "dev_a.startPower(50)",
      "",
    ].join("\n");
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("motor_start_power");
    expect(chain?.fields?.PORT).toBe("A");
    expect(chain?.inputs?.POWER.shadow?.fields?.NUM).toBe("50");
  });

  it("recognizes motor_stop when startPower(0)", () => {
    const src = [
      "dev_b = hub.ports.B.device()",
      "if not isinstance(dev_b, devices.motor):",
      '    raise TypeError("Port B: expected motor")',
      "dev_b.startPower(0)",
    ].join("\n");
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("motor_stop");
    expect(chain?.fields?.PORT).toBe("B");
  });

  it("recognizes basic_motor_power via basic_motor kind", () => {
    const src = [
      "dev_c = hub.ports.C.device()",
      "if not isinstance(dev_c, devices.basic_motor):",
      '    raise TypeError("Port C: expected basic_motor")',
      "dev_c.startPower(75)",
    ].join("\n");
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("basic_motor_power");
    expect(chain?.fields?.PORT).toBe("C");
    expect(chain?.inputs?.POWER.shadow?.fields?.NUM).toBe("75");
  });

  it("recognizes color_set_light after color_sensor setup", () => {
    const src = [
      "dev_d = hub.ports.D.device()",
      "if not isinstance(dev_d, devices.color_sensor):",
      '    raise TypeError("Port D: expected color_sensor")',
      "dev_d.setLight(10, 20, 30)",
    ].join("\n");
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("color_set_light");
    expect(chain?.fields?.PORT).toBe("D");
    expect(chain?.inputs?.L2.shadow?.fields?.NUM).toBe("20");
  });

  it("recognizes distance_set_light (4-arg setLight) after distance_sensor setup", () => {
    const src = [
      "dev_a = hub.ports.A.device()",
      "if not isinstance(dev_a, devices.distance_sensor):",
      '    raise TypeError("Port A: expected distance_sensor")',
      "dev_a.setLight(10, 20, 30, 40)",
    ].join("\n");
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("distance_set_light");
    expect(chain?.inputs?.L4.shadow?.fields?.NUM).toBe("40");
  });

  it("preserves setup group when device also has untranslatable use", () => {
    const src = [
      "dev_a = hub.ports.A.device()",
      "if not isinstance(dev_a, devices.color_sensor):",
      '    raise TypeError("Port A: expected color_sensor")',
      "dev_a.setMode(devices.color_sensor.MODE_COLOR)",
      "print(dev_a.getColorIdx())",
      "dev_a.setLight(1, 2, 3)",
    ].join("\n");
    const chain = pythonToBlocks(src);
    // Whole thing collapses into a single raw_python block (all-or-nothing).
    expect(chain?.type).toBe("raw_python");
    expect(chain?.data).toContain("dev_a = hub.ports.A.device()");
    expect(chain?.data).toContain("print(dev_a.getColorIdx())");
    expect(chain?.data).toContain("dev_a.setLight(1, 2, 3)");
  });

  it("independent ports: keeps raw for one, translates the other", () => {
    const src = [
      // Port A: untranslatable use — must stay raw
      "dev_a = hub.ports.A.device()",
      "if not isinstance(dev_a, devices.color_sensor):",
      '    raise TypeError("Port A: expected color_sensor")',
      "print(dev_a.getColorIdx())",
      // Port B: clean motor use — translates
      "dev_b = hub.ports.B.device()",
      "if not isinstance(dev_b, devices.motor):",
      '    raise TypeError("Port B: expected motor")',
      "dev_b.startSpeed(60)",
    ].join("\n");
    const types = chainTypes(pythonToBlocks(src));
    expect(types).toContain("raw_python");
    expect(types).toContain("motor_start_speed");
  });

  it("recognizes motor_set_acc_time with profile", () => {
    const src = [
      "dev_a = hub.ports.A.device()",
      "if not isinstance(dev_a, devices.motor):",
      '    raise TypeError("Port A: expected motor")',
      "dev_a.setAccTime(500, 1)",
    ].join("\n");
    const chain = pythonToBlocks(src);
    expect(chain?.type).toBe("motor_set_acc_time");
    expect(chain?.fields?.PROFILE).toBe("1");
    expect(chain?.inputs?.MS.shadow?.fields?.NUM).toBe("500");
  });

  it("recognizes hub_log_level and hub_lcd_backlight", () => {
    const src = "hub.log.setLevel(2)\nhub.lcd.on()\n";
    const types = chainTypes(pythonToBlocks(src));
    expect(types).toEqual(["hub_log_level", "hub_lcd_backlight"]);
  });
});

describe("round-trip (blocks → python → blocks → python)", () => {
  it("preserves motor_start_power exactly", () => {
    const { first, second } = roundTrip({
      type: "motor_start_power",
      fields: { PORT: "A" },
      inputs: { POWER: { block: { type: "math_number", fields: { NUM: 50 } } } },
    });
    expect(second).toBe(first);
  });

  it("preserves motor_stop exactly", () => {
    const { first, second } = roundTrip({
      type: "motor_stop",
      fields: { PORT: "B" },
    });
    expect(second).toBe(first);
  });

  it("preserves basic_motor_power exactly", () => {
    const { first, second } = roundTrip({
      type: "basic_motor_power",
      fields: { PORT: "C" },
      inputs: { POWER: { block: { type: "math_number", fields: { NUM: 75 } } } },
    });
    expect(second).toBe(first);
  });

  it("preserves motor_run_for_degrees exactly", () => {
    const { first, second } = roundTrip({
      type: "motor_run_for_degrees",
      fields: { PORT: "A" },
      inputs: {
        DEG: { block: { type: "math_number", fields: { NUM: 360 } } },
        SPEED: { block: { type: "math_number", fields: { NUM: 50 } } },
      },
    });
    expect(second).toBe(first);
  });

  it("preserves motor_set_acc_time exactly", () => {
    const { first, second } = roundTrip({
      type: "motor_set_acc_time",
      fields: { PORT: "A", PROFILE: "1" },
      inputs: { MS: { block: { type: "math_number", fields: { NUM: 500 } } } },
    });
    expect(second).toBe(first);
  });

  it("preserves color_set_light exactly", () => {
    const { first, second } = roundTrip({
      type: "color_set_light",
      fields: { PORT: "D" },
      inputs: {
        L1: { block: { type: "math_number", fields: { NUM: 10 } } },
        L2: { block: { type: "math_number", fields: { NUM: 20 } } },
        L3: { block: { type: "math_number", fields: { NUM: 30 } } },
      },
    });
    expect(second).toBe(first);
  });

  it("preserves distance_set_light exactly", () => {
    const { first, second } = roundTrip({
      type: "distance_set_light",
      fields: { PORT: "B" },
      inputs: {
        L1: { block: { type: "math_number", fields: { NUM: 10 } } },
        L2: { block: { type: "math_number", fields: { NUM: 20 } } },
        L3: { block: { type: "math_number", fields: { NUM: 30 } } },
        L4: { block: { type: "math_number", fields: { NUM: 40 } } },
      },
    });
    expect(second).toBe(first);
  });

  it("preserves hub_led_color exactly", () => {
    const { first, second } = roundTrip({
      type: "hub_led_color",
      fields: { COLOR: "RED" },
    });
    expect(second).toBe(first);
  });

  it("preserves hub_led_rgb exactly", () => {
    const { first, second } = roundTrip({
      type: "hub_led_rgb",
      inputs: {
        R: { block: { type: "math_number", fields: { NUM: 10 } } },
        G: { block: { type: "math_number", fields: { NUM: 20 } } },
        B: { block: { type: "math_number", fields: { NUM: 30 } } },
      },
    });
    expect(second).toBe(first);
  });

  it("preserves a mixed motor + sensor chain exactly", () => {
    const chain: BlockSpec = {
      type: "motor_start_speed",
      fields: { PORT: "A" },
      inputs: { SPEED: { block: { type: "math_number", fields: { NUM: 40 } } } },
      next: {
        block: {
          type: "color_set_light",
          fields: { PORT: "B" },
          inputs: {
            L1: { block: { type: "math_number", fields: { NUM: 10 } } },
            L2: { block: { type: "math_number", fields: { NUM: 20 } } },
            L3: { block: { type: "math_number", fields: { NUM: 30 } } },
          },
          next: {
            block: {
              type: "hub_led_color",
              fields: { COLOR: "BLUE" },
            },
          },
        },
      },
    };
    const { first, second } = roundTrip(chain);
    expect(second).toBe(first);
  });
});
