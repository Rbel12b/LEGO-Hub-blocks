# Device Protocol Spec

Firmware team implements this on the ESP32-S3 MicroPython hub. Web app implements the client side against exactly this spec. Reference: MicroPython upstream `tools/pyboard.py` (`raw_paste_write`).

## 1. Transports

Two transports supported. Both are byte-pipes. Sub-protocols on top are identical.

### 1.1 BLE — Nordic UART Service (NUS)

| Role | UUID |
|------|------|
| Service | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| RX (host → device, WRITE) | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX (device → host, NOTIFY) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |

- Advertise the NUS service UUID in the advertisement or scan response so `navigator.bluetooth.requestDevice({ filters:[{services:[NUS]}] })` matches.
- Firmware negotiates ATT MTU ≥ 185 (payload 182). Recommend 247 if stack supports.
- After successful subscription to TX notifications, firmware sends a one-time banner:
  ```
  \x04MTU=<n>\n
  ```
  where `<n>` is the negotiated ATT MTU (integer, base-10). Host chunks writes to `min(<n> - 3, 128)` bytes. `\x04` prefix keeps the banner distinguishable from REPL output.

### 1.2 USB Serial (CDC)

- ESP32-S3 native USB CDC. Baud 115200 8N1 (baud is nominal for CDC but host requests it).
- No banner needed; MTU concerns don't apply. Host may write in 4 KiB chunks.

### 1.3 Firmware bridge

For both transports, firmware bridges the byte pipe to the MicroPython REPL task:
- Bytes received from host → `sys.stdin` of the REPL.
- `sys.stdout` / `sys.stderr` of the REPL → notify/send back to host.

No extra framing added by firmware. All framing below is standard MicroPython REPL behavior.

## 2. Raw-paste REPL

Mirror of `pyboard.py:raw_paste_write`. The web app uses raw-paste for every code exec (live run, upload snippet, auto-run).

Bootstrap (only needed once per session, or after friendly-REPL is re-entered):

1. Host → `\r\x03\x03`  (CR + 2× Ctrl-C — abort any running program).
2. Host → `\r\x01`      (CR + Ctrl-A — enter raw REPL).
3. Device → `raw REPL; CTRL-B to exit\r\n>` — wait for this banner.

Per-exec raw-paste:

4. Host → `\x05A\x01`   (request raw-paste mode).
5. Device → `R\x01` + `<window-size:u16 LE>`  (4 bytes total; supported. `R\x00` = not supported).
6. Host streams code, respecting window flow-control:
   - Every time device sends `\x01`, host increments its remaining-window counter.
   - If device sends `\x04`, host aborts stream.
7. Host → `\x04`  (end of code).
8. Device → `\x04`  (ACK; program begins execution).
9. Device streams `sys.stdout` / `sys.stderr` bytes.
10. Device → `\x04` + `<exception-traceback-or-empty>` + `\x04>`  (execution done, prompt returned).

Exiting raw REPL:

- Host → `\x02`  (Ctrl-B — return to friendly REPL). Not required between execs; only on disconnect / mode switch.

## 3. File upload

**No new protocol.** Upload = raw-paste-exec a Python snippet that reads `<length>` bytes from `sys.stdin.buffer` and writes them to a file. Snippet template (host substitutes `<path>` and `<length>`):

```python
import sys
_p = "<path>"
if _p in ("/main.py", "/boot.py", "/boot.mpy"):
    raise ValueError("forbidden path")
_l = <length>
_b = bytearray()
while len(_b) < _l:
    _b += sys.stdin.buffer.read(min(64, _l - len(_b)))
with open(_p, "wb") as f:
    f.write(_b)
print("OK", _p, _l)
```

- Path allowlist enforced **client-side** AND in the emitted snippet:
  - Reject `/main.py`, `/boot.py`, `/boot.mpy` — always.
  - Require `/sd/` prefix unless the user's `settings.allowRoot` is true, in which case `/` is allowed (still with the three-name reject list).
- Host writes the snippet via raw-paste (§2), sending code up to and including `\x04`, then continues streaming raw file bytes as stdin. Device consumes them via `sys.stdin.buffer.read`. On completion device prints `OK <path> <length>\n`.
- Errors surface as MicroPython tracebacks in the `\x04 … \x04>` frame.

## 4. Auto-run

After a successful upload, host may raw-paste-exec:

```python
exec(open("<path>").read())
```

Toggled by `settings.autoRunAfterUpload` (default on).

## 5. Stop

Host sends `\x03\x03` (double Ctrl-C) on the byte pipe. Firmware forwards to MicroPython, which raises `KeyboardInterrupt`. Host code wraps `main()` in `try/except KeyboardInterrupt: pass` so this is a clean stop.

## 6. Error handling

- Any Python-level error appears as a traceback in the raw-paste tail frame (`\x04 <traceback> \x04>`). Host parses and shows in the Console panel.
- Transport-level errors (BLE `gattserverdisconnected`, Serial `disconnect`) surface as a toast + reconnect attempt (3× exponential backoff).

## 7. Firmware checklist

- [ ] Advertise NUS service UUID.
- [ ] Bridge NUS RX/TX ↔ MicroPython REPL stdin/stdout/stderr.
- [ ] Bridge USB CDC ↔ same REPL (multiplex or exclusive; document if exclusive).
- [ ] Send `\x04MTU=<n>\n` banner on BLE after TX subscribe.
- [ ] Negotiate ATT MTU ≥ 185 on BLE connect.
- [ ] Do NOT add framing above the byte pipe.
- [ ] Verify raw-paste (`\x05A\x01`) is available in the MicroPython build — it is standard as of v1.15+.
