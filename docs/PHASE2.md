# Phase 2 Scope

Everything deliberately deferred from Phase 1. Written now so context isn't lost.

## Block categories

### LVGL blocks (UI)
Wrap curated subset of `lvgl` (v9 binding on device). Emit `import lvgl as lv` + `hub.lcd.init()` once at program start.

- `lvgl_init_screen` — screen root object handle
- `lvgl_label` — text, x, y, color
- `lvgl_button` — label, x, y, w, h → returns handle
- `lvgl_button_on_click` — button handle → statement block (event callback)
- `lvgl_image` — asset key, x, y (asset table stored on `/sd/img/`)
- `lvgl_fill_screen` — color
- `lvgl_clear_screen`

LVGL API is huge (24k-line stub). Wrap only the widgets kids will touch.

### Advanced hub blocks
- `hub_imu_vector` — pick pitch/yaw/roll OR accel/gyro vector component
- `hub_imu_accel_xyz` — returns list [x, y, z] from `hub.imu.acceleration`
- `hub_imu_gyro_rate` — same for gyro
- `hub_board_pin_read/write` — raw pin via `hub.board.*`
- `hub_log_level` — `hub.log(<level>)`
- `hub_emulation_*` — for testing without hardware

### Basic motor
- `motor_basic_start_power` — `basic_motor` device (kind mismatch from `encoder_motor`)
- Extend setup emitter kind matrix.

### Port expander
- `expander_get_port` — chained port navigation (`portA.device().getPort(port_num.B)`)
- Deep nesting scenarios (see `examples/expander.py`).

### Remote hub
- Blocks for the standalone `lpf2.hub()` object (connecting to a physical LEGO Hub) — separate use case from the ESP32-S3 firmware. May not belong in this app.

## Advanced-blocks toggle rollout

Phase-2 defs ship pre-tagged `advanced: true`. `blocks/toolbox.ts` already filters. Enabling `settings.showAdvanced` reveals them zero-code-change.

## Editor upgrades

- **Monaco Pyright / LSP over websocket** — full autocomplete for `hub`, `lpf2`, `lvgl` in Python-only mode. Needs a tiny Node backend running Pyright.
- **Type-check panel** — surface Python errors before upload.

## Backend (optional)

- Project sharing (public link → JSON blob).
- Classroom dashboards (teacher sees student progress).
- OTA firmware distribution.
- Cloud project storage + accounts.

## scratch-blocks migration

Package is stale (last publish 2022). If it breaks on a future browser or Blockly major, fallback:
1. Swap to **Google Blockly** with a Scratch-styled theme (rounded, colorful).
2. Existing block defs / generators unchanged (they already use Blockly.Python).
3. Only workspace mount + toolbox XML changes.

Keep this option open: don't couple our code to scratch-blocks-specific APIs. Use the shared Blockly API surface where possible.

## Classroom / multi-project

- Project browser modal listing local + remote projects.
- Cloud sync toggle per project.
- Multi-tab editing.

## Firmware coordination

Once BLE REPL/upload is live on device, coordinate:
- Larger MTU negotiation (247+) for faster upload.
- Optional bulk file transfer via chunked framed sub-protocol (only if raw-paste-based upload proves too slow).
- Device-side `/sd/img/` asset mount contract for LVGL image blocks.
