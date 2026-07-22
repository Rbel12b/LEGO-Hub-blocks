import { useState } from "react";
import { BleTransport, bleSupported } from "../transport/ble";
import { SerialTransport, serialSupported } from "../transport/serial";
import { MockTransport } from "../transport/mock";
import { DeviceClient } from "../device/deviceClient";
import { useApp } from "../state/store";
import { sanitizeFilename } from "../utils/sanitize";
import { saveLastDeviceName } from "../project/storage";
import { newPythonProject } from "../project/format";

export function DeviceBar() {
  const { device, connection, connectionError, setDevice, setConnection, appendConsole, project, pythonPreview } = useApp();
  const loadProject = useApp((s) => s.loadProject);
  const [busy, setBusy] = useState(false);
  const dark = project.type === "python";

  const connect = async (kind: "ble" | "serial" | "mock") => {
    setBusy(true);
    setConnection("connecting");
    let client: DeviceClient | null = null;
    try {
      const transport =
        kind === "ble" ? new BleTransport() : kind === "serial" ? new SerialTransport() : new MockTransport();
      client = new DeviceClient(transport);
      transport.onData(() => {
        // Chunks are consumed by RawRepl; do not double-log.
      });
      transport.onDisconnect(() => {
        setConnection("disconnected");
        setDevice(null);
        appendConsole("info", "[device disconnected]\n");
      });
      await client.connect();
      setDevice(client);
      setConnection("connected");
      saveLastDeviceName(transport.info.name);
      appendConsole("info", `[connected: ${transport.info.name}]\n`);
    } catch (e) {
      setConnection("error", (e as Error).message);
      appendConsole("err", `[connect failed: ${(e as Error).message}]\n`);
      if (client) {
        try { await client.disconnect(); } catch { /* noop */ }
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!device) return;
    setBusy(true);
    try {
      await device.disconnect();
      setDevice(null);
      setConnection("disconnected");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!device) return;
    const code = project.type === "python" ? project.source : pythonPreview;
    if (!code.trim()) return;
    setBusy(true);
    appendConsole("info", "[run]\n");
    try {
      const res = await device.run(code, { onStdout: (t) => appendConsole("out", t) });
      if (res.stderr) appendConsole("err", res.stderr);
    } catch (e) {
      appendConsole("err", `[run failed: ${(e as Error).message}]\n`);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!device) return;
    try {
      await device.stop();
      appendConsole("info", "[stop]\n");
    } catch (e) {
      appendConsole("err", `[stop failed: ${(e as Error).message}]\n`);
    }
  };

  const loadFromDevice = async () => {
    if (!device) return;
    const path = window.prompt("Device file path:", "/sd/main.py");
    if (!path) return;
    setBusy(true);
    appendConsole("info", `[load ← ${path}]\n`);
    try {
      const source = await device.readFile(path);
      const title = path.split("/").pop()?.replace(/\.py$/, "") || "Untitled";
      loadProject({
        ...newPythonProject(title),
        source,
        settings: project.settings,
      });
      appendConsole("info", `[load OK: ${path} (${source.length}B)]\n`);
    } catch (e) {
      appendConsole("err", `[load failed: ${(e as Error).message}]\n`);
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!device) return;
    const code = project.type === "python" ? project.source : pythonPreview;
    if (!code.trim()) return;
    const base = sanitizeFilename(project.title);
    const path = (project.settings.allowRoot ? "/" : "/sd/") + base + ".py";
    setBusy(true);
    appendConsole("info", `[upload → ${path}]\n`);
    try {
      const bytes = new TextEncoder().encode(code);
      await device.upload(path, bytes, {
        policy: { allowRoot: project.settings.allowRoot },
        autoRun: project.settings.autoRunAfterUpload,
        onStdout: (t) => appendConsole("out", t),
      });
      appendConsole("info", `[upload OK: ${path} (${bytes.length}B)]\n`);
    } catch (e) {
      appendConsole("err", `[upload failed: ${(e as Error).message}]\n`);
    } finally {
      setBusy(false);
    }
  };

  const status = connection === "connected" ? `Connected` : connection === "connecting" ? "Connecting…" : connection === "error" ? `Error: ${connectionError}` : "Disconnected";

  const barBg = dark ? "#0b1216" : "#e0eff4";
  const barBorder = dark ? "#164e63" : "#b6dbe4";
  const barText = dark ? "#dff5fb" : "#0b3b48";

  const btnStyle: React.CSSProperties = {
    padding: "6px 12px",
    border: dark ? "1px solid #164e63" : "1px solid #b6dbe4",
    background: dark ? "#111a20" : "#ffffff",
    color: dark ? "#dff5fb" : "#0b3b48",
    cursor: "pointer",
    borderRadius: 6,
    fontWeight: 600,
  };

  const primaryBtn: React.CSSProperties = {
    ...btnStyle,
    background: "#0e7490",
    color: "#ffffff",
    border: "1px solid #155e75",
  };

  const dangerBtn: React.CSSProperties = {
    ...btnStyle,
    background: dark ? "#4a1414" : "#ffe4e4",
    color: dark ? "#ffb0b0" : "#8a1c1c",
    border: dark ? "1px solid #6a1c1c" : "1px solid #f0b4b4",
  };

  const successBtn: React.CSSProperties = {
    ...btnStyle,
    background: dark ? "#0f3e21" : "#e6f8ee",
    color: dark ? "#a9dcbc" : "#0f5e2f",
    border: dark ? "1px solid #1a5a30" : "1px solid #a9dcbc",
  };

  const badgeBg = (kind: "ok" | "err" | "idle") =>
    dark
      ? kind === "ok" ? "#0f3e21" : kind === "err" ? "#4a1414" : "#111a20"
      : kind === "ok" ? "#d7f2e0" : kind === "err" ? "#f9d7d7" : "#dff2f8";
  const badgeFg = (kind: "ok" | "err" | "idle") =>
    dark
      ? kind === "ok" ? "#a9dcbc" : kind === "err" ? "#ffb0b0" : "#dff5fb"
      : kind === "ok" ? "#0f5e2f" : kind === "err" ? "#8a1c1c" : "#0b3b48";
  const kind: "ok" | "err" | "idle" = connection === "connected" ? "ok" : connection === "error" ? "err" : "idle";

  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 14px", background: barBg, color: barText, alignItems: "center", borderBottom: `1px solid ${barBorder}` }}>
      {!device ? (
        <>
          <button type="button" style={primaryBtn} disabled={busy || !bleSupported()} onClick={() => connect("ble")} title={bleSupported() ? "" : "Web Bluetooth unsupported"}>
            Connect (BLE)
          </button>
          <button type="button" style={primaryBtn} disabled={busy || !serialSupported()} onClick={() => connect("serial")} title={serialSupported() ? "" : "Web Serial unsupported"}>
            Connect (USB)
          </button>
          {/* <button type="button" style={btnStyle} onClick={() => connect("mock")}>
            Connect (Mock)
          </button> */}
        </>
      ) : (
        <>
          <button type="button" style={btnStyle} disabled={busy} onClick={disconnect}>Disconnect</button>
          <button type="button" style={successBtn} disabled={busy} onClick={run}>Run</button>
          <button type="button" style={dangerBtn} disabled={busy} onClick={stop}>Stop</button>
          <button type="button" style={primaryBtn} disabled={busy} onClick={upload}>Upload</button>
          <button type="button" style={btnStyle} disabled={busy} onClick={loadFromDevice} title="Read a .py file from the device">Load</button>
        </>
      )}
      <span
        style={{
          marginLeft: "auto",
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 999,
          background: badgeBg(kind),
          color: badgeFg(kind),
          border: dark ? "1px solid #164e63" : "1px solid rgba(0,0,0,0.05)",
        }}
      >
        {status}
      </span>
    </div>
  );
}
