"""Board-provided hub module.

Exposes the on-device peripherals: LPF2 ports (`hub.ports`), hub LED,
IMU (`hub.imu`), buttons, LCD (LVGL), status log and power-off. Objects
here are singletons created by the C firmware — this module is a stub;
the real implementation lives in the ESP32 port.
"""

from lpf2 import port as _port
from lpf2.local import port as _local_port
from lpf2.devices import hub_led as _hub_led
from lpf2.devices import accelerometer as _accelerometer
from lpf2.devices import gyroscope as _gyroscope
from typing import Iterable, NoReturn, Optional, Union

class _vec3:
    """3-component float vector used for IMU acceleration / gyro samples."""
    x: float
    """X component."""
    y: float
    """Y component."""
    z: float
    """Z component."""
    def __init__(self, x: float, y: float, z: float) -> None: ...
    def length(self) -> float:
        """Euclidean length: ``sqrt(x*x + y*y + z*z)``."""
        ...
    def distance_to(self, other: "_vec3") -> float:
        """Euclidean distance between this vector and ``other``."""
        ...

class _imu_module:
    """On-board IMU (BNO085 or LSM6DSL, depending on board).

    Attitude fields are in degrees, wrapped to [-180, 180]. On BNO085
    boards the fusion is 9-DoF (accel + gyro + mag) done on-chip via the
    SH-2 Rotation Vector report — yaw has an absolute reference. On
    LSM6DSL boards fusion is a complementary filter on pitch/roll and
    gyro-integrated yaw (drifts; no magnetometer).
    """

    pitch: float
    """Fused pitch, degrees."""
    yaw: float
    """Fused yaw, degrees."""
    roll: float
    """Fused roll, degrees."""

    pitch_accel: float
    """Raw accel-derived pitch. Noisy but no drift. Degrees."""
    roll_accel: float
    """Raw accel-derived roll. Noisy but no drift. Degrees."""

    pitch_gyro: float
    """Pure gyro-integrated pitch. Drifts. Degrees."""
    yaw_gyro: float
    """Pure gyro-integrated yaw. Drifts. Degrees."""
    roll_gyro: float
    """Pure gyro-integrated roll. Drifts. Degrees."""

    acceleration: _vec3
    """Latest acceleration sample in mG, hub frame."""
    gyro_rate: _vec3
    """Latest gyro-rate sample in dps, hub frame. Calibrated bias subtracted."""

    calibrated: bool
    """LSM6DSL: post-reset gyro-bias averaging finished (~2 s after
    boot/reset). While False, gyro readings and yaw are held at 0.
    BNO085: rotation-vector status byte >= 2 (medium/high accuracy)."""

    def reset(self) -> None:
        """Zero yaw.

        LSM6DSL: restarts gyro-bias calibration — hub must be held
        stationary for ~2 s afterwards.
        BNO085: captures the current fused yaw as the new zero (Tare);
        no wait required.
        """
        ...

    def start_calibration(self) -> bool:
        """Enable all backend-supported calibrators.

        BNO085 already runs continuous cal by default; this makes it
        explicit. Perform figure-8 motion (mag) and place the hub in
        several flat orientations for a few seconds each (accel/gyro).
        Returns True on success.
        """
        ...

    def save_calibration(self) -> bool:
        """Persist current calibration to the sensor's non-volatile storage.

        BNO085: saves the Dynamic Calibration Data (DCD) into on-chip
        flash. LSM6DSL: no-op (gyro bias is recomputed every boot).
        Call once ``calibrated`` reads True. Returns True on success.
        """
        ...

class _ports_module:
    """Physical hub ports, exposed as :class:`lpf2.local.port` objects.

    ``A``..``D`` are the external LPF2 sockets; ``LED``, ``accelerometer``
    and ``gyro`` wrap the built-in devices behind LPF2-style ports.
    """
    A: _local_port
    """External port A."""
    B: _local_port
    """External port B."""
    C: _local_port
    """External port C."""
    D: _local_port
    """External port D."""
    LED: _port
    """Virtual port wrapping the built-in hub RGB LED."""
    accelerometer: _port
    """Virtual port wrapping the on-board accelerometer."""
    gyro: _port
    """Virtual port wrapping the on-board gyroscope."""

class _log_module:
    """Firmware log control."""
    def setLevel(self, level: int) -> None:
        """Set minimum log level printed by the C log macros."""
        ...

class _lcd_module:
    """LCD panel + LVGL control.

    The LCD is driven by ESP-IDF `esp_lcd` (ST7735) with an LVGL
    display layer on top. Some methods are LVGL-independent (raw panel
    access) and are useful to sanity-check wiring before LVGL is
    initialised.
    """

    def init(self) -> None:
        """Initialise LVGL.

        Must be called once from a MicroPython script before
        ``import lvgl`` — LVGL allocates via the MicroPython GC, whose
        state is thread-local to ``mp_task``, so C-side auto-init from
        ``hub_main_task`` crashes with LoadProhibited.
        """
        ...

    def on(self) -> None:
        """Backlight fully on (via PCA9685)."""
        ...

    def off(self) -> None:
        """Backlight off."""
        ...

    def backlight(self, duty: int) -> None:
        """Set backlight duty (0..255, mapped to PCA9685 0..4095)."""
        ...

    def reset(self) -> None:
        """Pulse the panel RESET line and re-init the panel driver."""
        ...

    def fill(self, rgb565: int) -> None:
        """Fill the panel with a solid RGB565 colour.

        Bypasses LVGL — useful to confirm the panel + SPI wiring work
        before LVGL renders anything.
        """
        ...

    def setInvert(self, on: bool) -> None:
        """Toggle panel colour inversion (ST7735 INVON / INVOFF)."""
        ...

    def setMadctl(self, byte: int) -> None:
        """Send raw MADCTL byte.

        Bits: MY(0x80) MX(0x40) MV(0x20) ML(0x10) BGR(0x08).
        """
        ...

    def setOffset(self, x: int, y: int) -> None:
        """Column/row start offsets applied to every CASET/RASET.

        Depends on panel variant (e.g. GreenTab wants (2, 3); 0.96"
        80x160 wants (26, 1)).
        """
        ...

    def cmd(self, cmd: int, data: bytes = b"") -> None:
        """Send an arbitrary command + optional data payload. For probing panels."""
        ...

from typing import Callable, Literal, Optional, overload

_ButtonName = Literal["center", "up", "down", "left", "right"]
_ButtonCb = Callable[[], None]

class _buttons_module:
    """On-board buttons: 5-way + power.

    Level readers (``center``/``up``/``down``/``left``/``right``)
    return the current held state. Callbacks fire on rising edge
    (release-then-press) inside :meth:`poll`, which the Python main
    loop must call to drive them.
    """

    def center(self) -> bool:
        """True while the power/center button is held.

        A short press reads as pressed; a >=2 s hold triggers a
        hardware power-off in the C loop.
        """
        ...
    def up(self) -> bool:
        """True while the UP button is held."""
        ...
    def down(self) -> bool:
        """True while the DOWN button is held."""
        ...
    def left(self) -> bool:
        """True while the LEFT button is held."""
        ...
    def right(self) -> bool:
        """True while the RIGHT button is held."""
        ...

    @overload
    def on(self, name: _ButtonName) -> Callable[[_ButtonCb], _ButtonCb]: ...
    @overload
    def on(self, name: _ButtonName, cb: Optional[_ButtonCb]) -> Optional[_ButtonCb]: ...
    def on(self, name, cb=None):
        """Register a callback for a button rising edge.

        Usable as a decorator::

            @hub.buttons.on("left")
            def left_pressed():
                ...

        Passing ``None`` as the second arg unregisters the callback.
        """
        ...

    def off(self, name: _ButtonName) -> None:
        """Unregister the callback for ``name``."""
        ...

    def poll(self) -> None:
        """Sample all buttons and dispatch pending rising-edge callbacks.

        Must be called from the Python main loop for callbacks to run.
        """
        ...

    def _snapshot(self) -> object:
        """Detach and return the current callback registry (or None if empty),
        leaving the registry cleared.

        Pair with :meth:`_restore` to swap in a scratch registry for a
        nested context (e.g. running a user program without letting
        outer callbacks fire).
        """
        ...
    def _restore(self, snapshot: object) -> None:
        """Reinstall a registry captured by :meth:`_snapshot`."""
        ...

class _board_module:
    """Board-specific pin/config constants (SD card etc.)."""
    SD_MODE: int
    """SD-card interface mode selected by the board (SPI vs SDMMC)."""
    SD_SLOT: int
    """SDMMC slot number."""
    SD_CS: int
    """SD chip-select pin (SPI mode)."""
    SD_SCK: int
    """SD clock pin (SPI mode)."""
    SD_MOSI: int
    """SD MOSI pin (SPI mode)."""
    SD_MISO: int
    """SD MISO pin (SPI mode)."""
    SD_WIDTH: int
    """SDMMC bus width (1 or 4)."""
    SD_CLK: int
    """SDMMC clock pin."""
    SD_CMD: int
    """SDMMC command pin."""
    SD_D0: int
    """SDMMC data-line 0."""
    SD_D1: int
    """SDMMC data-line 1 (4-bit mode)."""
    SD_D2: int
    """SDMMC data-line 2 (4-bit mode)."""
    SD_D3: int
    """SDMMC data-line 3 (4-bit mode)."""

    PORT_A_ID_1: int
    """Port A ID1 pin (LPF2 identification / analog-ID line 1)."""
    PORT_A_ID_2: int
    """Port A ID2 pin (LPF2 identification / analog-ID line 2)."""
    PORT_B_ID_1: int
    """Port B ID1 pin."""
    PORT_B_ID_2: int
    """Port B ID2 pin."""
    PORT_C_ID_1: int
    """Port C ID1 pin."""
    PORT_C_ID_2: int
    """Port C ID2 pin."""
    PORT_D_ID_1: int
    """Port D ID1 pin."""
    PORT_D_ID_2: int
    """Port D ID2 pin."""

    PORT_A_PWM_1: int
    """Port A H-bridge PWM channel 1 (M1)."""
    PORT_A_PWM_2: int
    """Port A H-bridge PWM channel 2 (M2)."""
    PORT_B_PWM_1: int
    """Port B H-bridge PWM channel 1."""
    PORT_B_PWM_2: int
    """Port B H-bridge PWM channel 2."""
    PORT_C_PWM_1: int
    """Port C H-bridge PWM channel 1."""
    PORT_C_PWM_2: int
    """Port C H-bridge PWM channel 2."""
    PORT_D_PWM_1: int
    """Port D H-bridge PWM channel 1."""
    PORT_D_PWM_2: int
    """Port D H-bridge PWM channel 2."""

ports: _ports_module
"""Hub ports (see :class:`_ports_module`)."""
log: _log_module
"""Firmware log control."""
led: _hub_led
"""Built-in hub RGB LED."""
accelerometer: _accelerometer
"""Built-in accelerometer wrapped as a Devices.accelerometer."""
gyro: _gyroscope
"""Built-in gyroscope wrapped as a Devices.gyroscope."""
board: _board_module
"""Board-specific constants (see :class:`_board_module`)."""
imu: _imu_module
"""Fused IMU (see :class:`_imu_module`)."""
lcd: _lcd_module
"""LCD + LVGL control (see :class:`_lcd_module`)."""
buttons: _buttons_module
"""Button API (see :class:`_buttons_module`)."""

def powerOff() -> NoReturn:
    """Turn the hub off immediately. Does not return."""
    ...

_HandlerName = Literal["setup", "loop"]
_Handler = Callable[[], None]

def on(name: _HandlerName) -> Callable[[_Handler], _Handler]:
    """Event decorator injected by the program runner in ``fs/main.py``.

    Only available when a script is launched from the on-device menu;
    not present when ``import hub`` runs from ``boot.py`` or the REPL.

    ``name`` is ``"setup"`` (runs once) or ``"loop"`` (runs each tick).
    """
    ...

# --- shim overlay (scripts/stubs-overlay) ------------------------
# Hub shim additions. Appended verbatim to the fw-sourced hub.pyi by
# scripts/sync-stubs.mjs. Declares symbols that live in the on-device
# Python shim layer but are not present in the firmware C module stubs.

# Sleep for `seconds` (float, seconds). Compatible with `time.sleep`, but
# calls `hub.buttons.poll()` while waiting so button callbacks still fire.
# Does not run the user `loop()` again — only polls buttons.
def sleep(seconds: float) -> None: ...

# Sleep for `ms` milliseconds. Compatible with `time.sleep_ms`, but polls
# hub buttons during the wait (no user `loop()` re-entry).
def sleep_ms(ms: int) -> None: ...

# Request the runner to stop the user program. Sets the runner's STOP
# flag; the main loop exits after the current iteration and any active
# `hub.sleep`/`hub.sleep_ms` returns early. Does not raise.
def exit() -> None: ...
