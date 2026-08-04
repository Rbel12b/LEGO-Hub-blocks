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
