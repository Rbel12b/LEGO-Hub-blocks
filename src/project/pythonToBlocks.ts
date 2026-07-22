/**
 * Best-effort Python → Blockly translator used when switching a Python project
 * back to Blocks mode. Lines that match one of the patterns emitted by our own
 * generators become the corresponding block; lines that don't match are
 * buffered into `raw_python` blocks between the recognized ones so nothing is
 * silently lost.
 *
 * Device setup boilerplate (`dev_x = hub.ports.X.device()`, isinstance guard,
 * `setMode`) is only dropped when every reference to `dev_x` translates to a
 * known block. Otherwise the whole setup + uses are preserved as raw Python so
 * the generated program still runs.
 */

export interface BlockSpec {
  type: string;
  fields?: Record<string, string>;
  inputs?: Record<string, { block?: BlockSpec; shadow?: BlockSpec }>;
  data?: string;
  next?: { block: BlockSpec };
}

const COLOR_NAMES = new Set([
  "BLACK", "PINK", "PURPLE", "BLUE", "LIGHTBLUE", "CYAN",
  "GREEN", "YELLOW", "ORANGE", "RED", "WHITE", "NONE",
]);
const LOG_LEVELS = new Set(["0", "1", "2", "3"]);
const ACCEL_PROFILES = new Set(["0", "1"]);

type DeviceKind =
  | "color_sensor"
  | "distance_sensor"
  | "color_distance_sensor"
  | "motor"
  | "basic_motor";
const DEVICE_KINDS = new Set<DeviceKind>([
  "color_sensor",
  "distance_sensor",
  "color_distance_sensor",
  "motor",
  "basic_motor",
]);

function numInput(name: string, expr: string) {
  return { [name]: { shadow: { type: "math_number", fields: { NUM: expr } } } };
}

/** Stateless top-level statements — no device variable involved. */
function matchStatement(line: string): BlockSpec | null {
  let m: RegExpExecArray | null;

  if ((m = /^hub\.ports\.LED\.setRgbColorIdx\(lpf2\.color\.([A-Z]+)\)$/.exec(line))) {
    if (COLOR_NAMES.has(m[1])) return { type: "hub_led_color", fields: { COLOR: m[1] } };
  }

  if ((m = /^hub\.ports\.LED\.setRgbColor\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/.exec(line))) {
    return {
      type: "hub_led_rgb",
      inputs: { ...numInput("R", m[1]), ...numInput("G", m[2]), ...numInput("B", m[3]) },
    };
  }

  if (line === "hub.buttons.poll()") return { type: "hub_button_poll" };
  if (line === "hub.imu.reset()") return { type: "hub_imu_reset" };
  if (line === "hub.powerOff()") return { type: "hub_poweroff" };

  if ((m = /^hub\.log\.setLevel\((\d)\)$/.exec(line))) {
    if (LOG_LEVELS.has(m[1])) return { type: "hub_log_level", fields: { LEVEL: m[1] } };
  }

  if ((m = /^hub\.lcd\.(on|off)\(\)$/.exec(line))) {
    return { type: "hub_lcd_backlight", fields: { STATE: m[1] } };
  }

  if ((m = /^hub\.lcd\.backlight\((-?\d+)\)$/.exec(line))) {
    return { type: "hub_lcd_backlight_duty", inputs: numInput("DUTY", m[1]) };
  }

  if ((m = /^hub\.lcd\.fill\((-?\d+)\)$/.exec(line))) {
    return { type: "hub_lcd_fill", inputs: numInput("COLOR", m[1]) };
  }

  return null;
}

/**
 * Statements that operate on a device variable. Requires that the port's kind
 * was inferred from a preceding isinstance guard.
 */
function matchDeviceStatement(
  line: string,
  portKind: Map<string, DeviceKind>,
): BlockSpec | null {
  let m: RegExpExecArray | null;

  const withPort = (re: RegExp): { port: string; groups: string[] } | null => {
    m = re.exec(line);
    if (!m) return null;
    return { port: m[1].toUpperCase(), groups: m.slice(1) };
  };

  const kindOf = (portUpper: string) => portKind.get(portUpper.toLowerCase());

  let r;

  // Motor family (device kind: motor)
  if ((r = withPort(/^dev_([a-d])\.startSpeed\((-?\d+)\)$/))) {
    if (kindOf(r.port) === "motor")
      return { type: "motor_start_speed", fields: { PORT: r.port }, inputs: numInput("SPEED", r.groups[1]) };
  }
  if ((r = withPort(/^dev_([a-d])\.startPower\((-?\d+)\)$/))) {
    const k = kindOf(r.port);
    const power = r.groups[1];
    if (k === "motor") {
      if (power === "0") return { type: "motor_stop", fields: { PORT: r.port } };
      return { type: "motor_start_power", fields: { PORT: r.port }, inputs: numInput("POWER", power) };
    }
    if (k === "basic_motor")
      return { type: "basic_motor_power", fields: { PORT: r.port }, inputs: numInput("POWER", power) };
  }
  if ((r = withPort(/^dev_([a-d])\.startSpeedForTime\((-?\d+),\s*(-?\d+)\)$/))) {
    if (kindOf(r.port) === "motor")
      return {
        type: "motor_run_for_time",
        fields: { PORT: r.port },
        inputs: { ...numInput("MS", r.groups[1]), ...numInput("SPEED", r.groups[2]) },
      };
  }
  if ((r = withPort(/^dev_([a-d])\.startSpeedForDegrees\((-?\d+),\s*(-?\d+)\)$/))) {
    if (kindOf(r.port) === "motor")
      return {
        type: "motor_run_for_degrees",
        fields: { PORT: r.port },
        inputs: { ...numInput("DEG", r.groups[1]), ...numInput("SPEED", r.groups[2]) },
      };
  }
  if ((r = withPort(/^dev_([a-d])\.gotoAbsPosition\((-?\d+),\s*(-?\d+)\)$/))) {
    if (kindOf(r.port) === "motor")
      return {
        type: "motor_goto_position",
        fields: { PORT: r.port },
        inputs: { ...numInput("DEG", r.groups[1]), ...numInput("SPEED", r.groups[2]) },
      };
  }
  if ((r = withPort(/^dev_([a-d])\.presetEncoder\(0\)$/))) {
    if (kindOf(r.port) === "motor")
      return { type: "motor_reset_encoder", fields: { PORT: r.port } };
  }
  if ((r = withPort(/^dev_([a-d])\.setAccTime\((-?\d+),\s*(\d)\)$/))) {
    if (kindOf(r.port) === "motor" && ACCEL_PROFILES.has(r.groups[2]))
      return {
        type: "motor_set_acc_time",
        fields: { PORT: r.port, PROFILE: r.groups[2] },
        inputs: numInput("MS", r.groups[1]),
      };
  }
  if ((r = withPort(/^dev_([a-d])\.setDecTime\((-?\d+),\s*(\d)\)$/))) {
    if (kindOf(r.port) === "motor" && ACCEL_PROFILES.has(r.groups[2]))
      return {
        type: "motor_set_dec_time",
        fields: { PORT: r.port, PROFILE: r.groups[2] },
        inputs: numInput("MS", r.groups[1]),
      };
  }

  // Sensor family: setLight statement blocks.
  if ((r = withPort(/^dev_([a-d])\.setLight\((-?\d+),\s*(-?\d+),\s*(-?\d+)\)$/))) {
    if (kindOf(r.port) === "color_sensor")
      return {
        type: "color_set_light",
        fields: { PORT: r.port },
        inputs: {
          ...numInput("L1", r.groups[1]),
          ...numInput("L2", r.groups[2]),
          ...numInput("L3", r.groups[3]),
        },
      };
  }
  if ((r = withPort(/^dev_([a-d])\.setLight\((-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\)$/))) {
    if (kindOf(r.port) === "distance_sensor")
      return {
        type: "distance_set_light",
        fields: { PORT: r.port },
        inputs: {
          ...numInput("L1", r.groups[1]),
          ...numInput("L2", r.groups[2]),
          ...numInput("L3", r.groups[3]),
          ...numInput("L4", r.groups[4]),
        },
      };
  }

  return null;
}

/** Auto-generated preamble unrelated to any device variable. */
function isPreambleBoilerplate(line: string): boolean {
  if (line === "") return true;
  if (/^import\s/.test(line)) return true;
  if (/^from\s/.test(line)) return true;
  if (line === "hub.lcd.init()") return true;
  if (line === "_scr = lv.screen_active()") return true;
  return false;
}

/** Chunk = one top-level line plus any indented lines that follow it. */
interface Chunk {
  lines: string[];
}

function chunkify(source: string): Chunk[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const chunks: Chunk[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (/^\s+/.test(line) && chunks.length) {
      chunks[chunks.length - 1].lines.push(line);
    } else {
      chunks.push({ lines: [line] });
    }
  }
  return chunks;
}

/** Ports referenced by any `dev_<a-d>` identifier in the chunk. */
function refsInChunk(chunk: Chunk): Set<string> {
  const found = new Set<string>();
  const re = /\bdev_([a-d])\b/g;
  for (const l of chunk.lines) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(l))) found.add(m[1]);
  }
  return found;
}

type DeviceRole = "setup1" | "setup2" | "setMode" | "warn" | "translatable" | "opaque";

function classifyDeviceChunk(
  chunk: Chunk,
  portKind: Map<string, DeviceKind>,
): { role: DeviceRole; block?: BlockSpec; port?: string; kind?: DeviceKind } {
  if (chunk.lines.length === 1) {
    const line = chunk.lines[0];
    let m: RegExpExecArray | null;
    if ((m = /^dev_([a-d])\s*=\s*hub\.ports\.[A-D]\.device\(\)$/.exec(line))) {
      return { role: "setup1", port: m[1] };
    }
    if (/^dev_[a-d]\.setMode\(/.test(line)) {
      const p = /\bdev_([a-d])\b/.exec(line)?.[1];
      return { role: "setMode", port: p };
    }
    if (/^# WARN: port [A-D] used as/.test(line)) {
      const p = /port ([A-D])/.exec(line)?.[1]?.toLowerCase();
      return { role: "warn", port: p };
    }
    const block = matchDeviceStatement(line, portKind);
    if (block) {
      const p = /\bdev_([a-d])\b/.exec(line)?.[1];
      return { role: "translatable", block, port: p };
    }
    return { role: "opaque" };
  }
  // Multi-line chunk: is it the isinstance guard?
  const first = chunk.lines[0];
  const second = chunk.lines[1] ?? "";
  const m = /^if not isinstance\(dev_([a-d]), devices\.(\w+)\):$/.exec(first);
  if (m && /^\s+raise TypeError\(/.test(second)) {
    const kind = m[2];
    if (DEVICE_KINDS.has(kind as DeviceKind)) {
      // Guard chunk may only contain header + raise line; anything else means
      // the user glued extra logic here — treat as opaque so we keep it.
      const extra = chunk.lines.slice(2).some((l) => l.trim() !== "");
      if (!extra) return { role: "setup2", port: m[1], kind: kind as DeviceKind };
    }
  }
  return { role: "opaque" };
}

function makeRaw(source: string): BlockSpec | null {
  const trimmed = source.replace(/\s+$/, "");
  if (!trimmed) return null;
  return { type: "raw_python", data: trimmed };
}

function chain(specs: BlockSpec[]): BlockSpec | undefined {
  if (specs.length === 0) return undefined;
  for (let i = specs.length - 1; i > 0; i--) {
    specs[i - 1].next = { block: specs[i] };
  }
  return specs[0];
}

export function hasRawBlock(chain: BlockSpec | undefined): boolean {
  let cur: BlockSpec | undefined = chain;
  while (cur) {
    if (cur.type === "raw_python") return true;
    cur = cur.next?.block;
  }
  return false;
}

/** Normalize Python source for round-trip equivalence: strip trailing spaces,
 *  collapse runs of blank lines, and drop leading/trailing whitespace. */
export function normalizePython(src: string): string {
  return src
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pythonToBlocks(source: string): BlockSpec | undefined {
  const chunks = chunkify(source);

  // Pass 1: infer port → device kind from isinstance guards.
  const portKind = new Map<string, DeviceKind>();
  for (const c of chunks) {
    const info = classifyDeviceChunk(c, portKind);
    if (info.role === "setup2" && info.port && info.kind) {
      portKind.set(info.port, info.kind);
    }
  }

  // Pass 2: any opaque chunk that touches dev_x forces port x to keep raw.
  const keepRaw = new Set<string>();
  for (const c of chunks) {
    const refs = refsInChunk(c);
    if (refs.size === 0) continue;
    const info = classifyDeviceChunk(c, portKind);
    if (info.role === "opaque") for (const p of refs) keepRaw.add(p);
  }

  // Pass 3: emit.
  const specs: BlockSpec[] = [];
  let rawBuffer: string[] = [];
  const flushRaw = () => {
    if (!rawBuffer.length) return;
    const raw = makeRaw(rawBuffer.join("\n"));
    if (raw) specs.push(raw);
    rawBuffer = [];
  };
  const emitRawChunk = (c: Chunk) => {
    for (const l of c.lines) rawBuffer.push(l);
  };

  for (const c of chunks) {
    const refs = refsInChunk(c);
    if (refs.size === 0) {
      if (c.lines.length === 1) {
        const line = c.lines[0];
        if (isPreambleBoilerplate(line)) continue;
        const block = matchStatement(line);
        if (block) {
          flushRaw();
          specs.push(block);
        } else {
          rawBuffer.push(line);
        }
      } else {
        emitRawChunk(c);
      }
      continue;
    }

    // Chunk references at least one dev_x.
    const anyKeepRaw = [...refs].some((p) => keepRaw.has(p));
    if (anyKeepRaw) {
      emitRawChunk(c);
      continue;
    }

    // All referenced ports are cleanly translatable — drop boilerplate,
    // emit a block for translatable statements.
    const info = classifyDeviceChunk(c, portKind);
    if (info.role === "translatable" && info.block) {
      flushRaw();
      specs.push(info.block);
    }
    // setup1 / setup2 / setMode / warn silently dropped — regenerator re-emits.
  }
  flushRaw();

  return chain(specs);
}
