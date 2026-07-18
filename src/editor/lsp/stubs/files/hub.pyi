from lpf2 import port as _port
from lpf2.local import port as _local_port
from lpf2.devices import hub_led as _hub_led
from lpf2.devices import accelerometer as _accelerometer
from lpf2.devices import gyroscope as _gyroscope
from typing import NoReturn

class _vec3:
    x: float
    y: float
    z: float
    def __init__(self, x: float, y: float, z: float) -> None: ...
    def length(self) -> float: ...
    def distance_to(self, other: "_vec3") -> float: ...

class _imu_module:
    # Fused (complementary filter for pitch/roll; yaw is gyro-integrated
    # with post-reset bias calibration — residual drift after that is
    # limited by gyro noise/temperature). Values in degrees, wrapped to
    # [-180, 180].
    pitch: float
    yaw: float
    roll: float
    # Raw accel-derived tilt. Noisy but no drift. Degrees.
    pitch_accel: float
    roll_accel: float
    # Pure gyro integration. Drifts on every axis. Degrees.
    pitch_gyro: float
    yaw_gyro: float
    roll_gyro: float
    # Latest sample. mG for accel, dps for gyro. Hub frame.
    # gyro_rate has the calibrated bias subtracted.
    acceleration: _vec3
    gyro_rate: _vec3
    # True once the post-reset gyro bias calibration has finished (~2 s
    # after boot / reset). While False, yaw is held at 0.
    calibrated: bool
    # Zero yaw and restart gyro bias calibration. The hub must be held
    # stationary for ~2 s after this call for calibration to be meaningful.
    def reset(self) -> None: ...

class _ports_module:
    A: _local_port
    B: _local_port
    C: _local_port
    D: _local_port
    LED: _port
    accelerometer: _port
    gyro: _port

class _log_module:
    def setLevel(self, level: int) -> None: ...

class _lcd_module:
    # Initialise LVGL. Must be called once from a MicroPython script before
    # `import lvgl` — LVGL allocates via the MicroPython GC, whose state is
    # thread-local to mp_task, so C-side auto-init from hub_main_task
    # crashes with LoadProhibited.
    def init(self) -> None: ...
    # Backlight fully on (via PCA9685).
    def on(self) -> None: ...
    # Backlight off.
    def off(self) -> None: ...
    # Set backlight duty 0..255.
    def backlight(self, duty: int) -> None: ...
    # Pulse the panel RESET line and re-init the panel driver.
    def reset(self) -> None: ...
    # Fill the panel with a solid RGB565 colour. Bypasses LVGL — useful to
    # confirm the panel + SPI wiring work before LVGL renders anything.
    def fill(self, rgb565: int) -> None: ...
    # Toggle panel colour inversion (ST7735 INVON / INVOFF).
    def setInvert(self, on: bool) -> None: ...
    # Send raw MADCTL byte. Bits: MY(0x80) MX(0x40) MV(0x20) ML(0x10) BGR(0x08).
    def setMadctl(self, byte: int) -> None: ...
    # Column / row start offsets applied to every CASET/RASET. Depends on
    # panel variant (e.g. GreenTab wants (2,3); 0.96" 80x160 wants (26,1)).
    def setOffset(self, x: int, y: int) -> None: ...
    # Send an arbitrary command + optional data payload. For probing panels.
    def cmd(self, cmd: int, data: bytes = b"") -> None: ...

from typing import Callable, Literal, Optional, overload

_ButtonName = Literal["center", "up", "down", "left", "right"]
_ButtonCb = Callable[[], None]

class _buttons_module:
    # Each returns True while its button is held.
    # `center` is an alias for the power button — a short press reads
    # as pressed; a >=10 s hold triggers a hardware power-off in the C loop.
    def center(self) -> bool: ...
    def up(self) -> bool: ...
    def down(self) -> bool: ...
    def left(self) -> bool: ...
    def right(self) -> bool: ...

    # Callback API. Callbacks fire on rising edge (release-then-press)
    # inside `poll()`. `poll()` must be called from the Python main loop
    # for callbacks to run.
    #
    #     @hub.buttons.on("left")
    #     def left_pressed():
    #         ...
    #
    # Passing `None` as the second arg unregisters the callback.
    @overload
    def on(self, name: _ButtonName) -> Callable[[_ButtonCb], _ButtonCb]: ...
    @overload
    def on(self, name: _ButtonName, cb: Optional[_ButtonCb]) -> Optional[_ButtonCb]: ...
    def off(self, name: _ButtonName) -> None: ...
    def poll(self) -> None: ...

class _board_module:
    SD_MODE: int
    SD_SLOT: int
    SD_CS: int
    SD_SCK: int
    SD_MOSI: int
    SD_MISO: int
    SD_WIDTH: int
    SD_CLK: int
    SD_CMD: int
    SD_D0: int
    SD_D1: int
    SD_D2: int
    SD_D3: int

ports: _ports_module
log: _log_module
led: _hub_led
accelerometer: _accelerometer
gyro: _gyroscope
board: _board_module
imu: _imu_module
lcd: _lcd_module
buttons: _buttons_module

def powerOff() -> NoReturn: ...