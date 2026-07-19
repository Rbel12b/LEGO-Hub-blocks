import { useState } from "react";
import { BleTransport, bleSupported } from "../transport/ble";
import { SerialTransport, serialSupported } from "../transport/serial";
import { MockTransport } from "../transport/mock";
import { DeviceClient } from "../device/deviceClient";
import { useApp } from "../state/store";
import { sanitizeFilename } from "../utils/sanitize";
import { saveLastDeviceName } from "../project/storage";

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#eee",
  cursor: "pointer",
  borderRadius: 4,
};

export function DeviceBar() {
  const { device, connection, connectionError, setDevice, setConnection, appendConsole, project, pythonPreview } = useApp();
  const [busy, setBusy] = useState(false);

  const connect = async (kind: "ble" | "serial" | "mock") => {
    setBusy(true);
    setConnection("connecting");
    try {
      const transport =
        kind === "ble" ? new BleTransport() : kind === "serial" ? new SerialTransport() : new MockTransport();
      const client = new DeviceClient(transport);
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

  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 12px", background: "#1a1a1a", color: "#ddd", alignItems: "center", borderBottom: "1px solid #333" }}>
      {!device ? (
        <>
          <button type="button" style={btnStyle} disabled={busy || !bleSupported()} onClick={() => connect("ble")} title={bleSupported() ? "" : "Web Bluetooth unsupported"}>
            Connect (BLE)
          </button>
          <button type="button" style={btnStyle} disabled={busy || !serialSupported()} onClick={() => connect("serial")} title={serialSupported() ? "" : "Web Serial unsupported"}>
            Connect (USB)
          </button>
          {/* <button type="button" style={btnStyle} onClick={() => connect("mock")}>
            Connect (Mock)
          </button> */}
        </>
      ) : (
        <>
          <button type="button" style={btnStyle} disabled={busy} onClick={disconnect}>Disconnect</button>
          <button type="button" style={{ ...btnStyle, background: "#155" }} disabled={busy} onClick={run}>Run</button>
          <button type="button" style={{ ...btnStyle, background: "#511" }} disabled={busy} onClick={stop}>Stop</button>
          <button type="button" style={{ ...btnStyle, background: "#252" }} disabled={busy} onClick={upload}>Upload</button>
        </>
      )}
      <span style={{ marginLeft: "auto", opacity: 0.8 }}>{status}</span>
    </div>
  );
}
