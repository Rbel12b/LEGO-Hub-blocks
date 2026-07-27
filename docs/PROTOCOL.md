# Device Protocol Spec (HubProtocol)

Custom side-channel over the same byte stream (BLE NUS / USB CDC). Replaces raw MicroPython REPL entirely for all web-app operations. The device disables `micropython.kbd_intr(-1)` at boot so control bytes on stdin are NOT interpreted as REPL commands — they belong to us.

## 1. Transports

Two byte-pipe transports. Sub-protocol is identical on both.

### 1.1 BLE — Nordic UART Service (NUS)

| Role | UUID |
|------|------|
| Service | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| RX (host → device, WRITE) | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX (device → host, NOTIFY) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |

Firmware advertises the NUS service UUID and negotiates ATT MTU ≥ 185.

### 1.2 USB Serial (CDC)

ESP32-S3 native USB CDC. Baud 115200 8N1.

### 1.3 Firmware bridge

Firmware bridges the byte pipe to MicroPython `sys.stdin` / `sys.stdout`. No framing added by firmware. Framing below is applied by the on-device `main.py` protocol listener + web-side `HubProtocol` client.

## 2. Frame format

Delimiter: **`0x1E`** (ASCII Record Separator, RS). Any byte on the wire outside a frame is stdout (device → web) or discarded (web → device).

### 2.1 Web → Device

```
\x1e RUN <path>\n                          launch runner.run_program(path)
\x1e UPLOAD <path> <length>\n<length bytes> write file (raw bytes follow header)
\x1e STOP\n                                sets runner._stop_flag; loop exits at next tick
\x1e READ <path>\n                         read file; reply DATA
\x1e PING\n                                health check
```

Header line is UTF-8 up to `\n`. For UPLOAD, exactly `<length>` raw bytes follow the header line — the device reads them via `sys.stdin.buffer.read` without further parsing (bytes may contain any value including 0x1E).

### 2.2 Device → Web

```
\x1e OK <msg>\n                            control success
\x1e ERR <msg>\n                           control error (message = traceback or reason)
\x1e DATA <length> <msg>\n<length bytes>   binary reply (READ)
<other bytes>                              stdout — streamed to console
```

For RUN, the device replies `OK RUN <path>` immediately once the file is confirmed to exist, then streams program stdout, then either `OK done <path>` or `ERR <traceback>` when the runner returns. Web app can pair each control command with the next non-stdout frame.

## 3. RUN semantics

- `runner.run_program(path)` sets up a `sys.modules["hub"]` shim exposing an `on` decorator.
- User code is executed at module scope. `@on("setup")` and `@on("loop")` registrations are captured.
- After module-scope execution, `setup()` runs once, then `loop()` runs repeatedly.
- The runner also polls `_stop_flag` (set by STOP frame) and center-button-held-2s to exit cleanly.
- On exit, hub button callbacks captured before the program ran are restored (menu resumes).

## 4. UPLOAD path allowlist

Client-side and device-side both reject:

- `/main.py`, `/boot.py`, `/boot.mpy`, `/runner.py` — always.
- Any path outside `/sd/` unless `settings.allowRoot` is enabled.

## 5. STOP semantics

STOP is asynchronous: it sets `runner._stop_flag`. The runner checks the flag before each loop iteration. Long `time.sleep_ms` calls inside `loop()` delay the response — programs should sleep in ≤100 ms chunks.

## 6. Firmware checklist

- [ ] Advertise NUS service UUID.
- [ ] Bridge NUS RX/TX ↔ MicroPython stdin/stdout.
- [ ] Bridge USB CDC ↔ same stdin/stdout.
- [ ] `main.py` calls `micropython.kbd_intr(-1)` before starting its protocol poller.
- [ ] `main.py` polls stdin in its idle loop via `uselect.poll(sys.stdin)`.
- [ ] `runner.py` shim: `_HubShim` + `on()` + `run_program(path, poll_stdin)`.

## 7. REPL is unavailable

Because `kbd_intr` is disabled and the device consumes control bytes as protocol frames, the classic MicroPython REPL is unusable while `main.py` runs. **Every program must be uploaded** — there is no way to run a snippet interactively. Web-app `Run` button uploads the current source to `/sd/<title>.py` then sends a RUN frame.
