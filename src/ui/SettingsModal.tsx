import { useApp } from "../state/store";
import type { LspMode } from "../project/format";

interface Props {
  onClose: () => void;
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: "#222",
  color: "#eee",
  padding: 20,
  borderRadius: 8,
  minWidth: 380,
  border: "1px solid #444",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  margin: "8px 0",
};

export function SettingsModal({ onClose }: Props) {
  const settings = useApp((s) => s.project.settings);
  const update = useApp((s) => s.updateSettings);

  const toggle = (key: keyof typeof settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ [key]: e.target.checked });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <label style={row}>
          <input type="checkbox" checked={settings.showAdvanced} onChange={toggle("showAdvanced")} />
          Show advanced blocks
        </label>
        <label style={row}>
          <input type="checkbox" checked={settings.autoRunAfterUpload} onChange={toggle("autoRunAfterUpload")} />
          Auto-run after upload
        </label>
        <label style={row}>
          <input type="checkbox" checked={settings.autoreloadInLive} onChange={toggle("autoreloadInLive")} />
          Autoreload on block edit (live mode)
        </label>
        <label style={row}>
          <input type="checkbox" checked={settings.allowRoot} onChange={toggle("allowRoot")} />
          Allow uploads to root filesystem (advanced)
        </label>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Uploads default to <code>/sd/</code>. With this enabled, uploads may target <code>/</code>.<br />
          Uploads to <code>/main.py</code>, <code>/boot.py</code>, <code>/boot.mpy</code> are always rejected.
        </p>

        <h4 style={{ marginTop: 18, marginBottom: 4 }}>Python LSP</h4>
        <label style={row}>
          Mode:
          <select
            value={settings.lspMode}
            onChange={(e) => update({ lspMode: e.target.value as LspMode })}
          >
            <option value="off">Off</option>
            <option value="worker">In-browser (Pyright worker)</option>
            <option value="remote">Remote (WebSocket)</option>
          </select>
        </label>
        {settings.lspMode === "remote" && (
          <label style={row}>
            URL:
            <input
              type="text"
              value={settings.lspRemoteUrl}
              onChange={(e) => update({ lspRemoteUrl: e.target.value })}
              style={{ flex: 1, background: "#111", color: "#eee", border: "1px solid #444", padding: 4 }}
            />
          </label>
        )}
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Provides completion, hover, signature help, and diagnostics for the
          built-in Python editor. Remote mode needs the server in <code>docs/lsp-server/</code>.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: "6px 14px" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
