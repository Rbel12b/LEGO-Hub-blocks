import { useState } from "react";
import { useApp } from "../state/store";
import { downloadProject, pickFile } from "../project/download";
import type { AnyProject, BlocksProject } from "../project/format";
import { newBlocksProject, newPythonProject } from "../project/format";
import { pythonToBlocks } from "../project/pythonToBlocks";

interface Props {
  onOpenSettings: () => void;
}

function blocksProjectFromPython(source: string, title: string, settings: BlocksProject["settings"]): BlocksProject {
  const base = newBlocksProject(title);
  const chain = pythonToBlocks(source);
  const hat: Record<string, unknown> = { type: "on_program_start", x: 40, y: 40 };
  if (chain) hat.next = { block: chain };
  return {
    ...base,
    settings,
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [hat],
      },
    },
  };
}

export function Header({ onOpenSettings }: Props) {
  const { project, setProject } = useApp();
  const [switchPrompt, setSwitchPrompt] = useState(false);
  const dark = project.type === "python";

  const rename = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProject({ ...project, title: e.target.value });
  };

  const toggleType = () => {
    if (project.type === "blocks") {
      const source = useApp.getState().pythonPreview || "";
      setProject({ ...newPythonProject(project.title), settings: project.settings, source });
    } else {
      setSwitchPrompt(true);
    }
  };

  const confirmSwitch = (mode: "best-effort" | "discard") => {
    if (project.type !== "python") return setSwitchPrompt(false);
    if (mode === "best-effort") {
      setProject(blocksProjectFromPython(project.source, project.title, project.settings));
    } else {
      setProject({ ...newBlocksProject(project.title), settings: project.settings });
    }
    setSwitchPrompt(false);
  };

  const openFile = async () => {
    const file = await pickFile(".json,.blocksproj.json,.py");
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith(".py")) {
      setProject({
        ...newPythonProject(file.name.replace(/\.py$/, "")),
        source: text,
      });
    } else {
      try {
        const p = JSON.parse(text) as AnyProject;
        setProject(p);
      } catch (e) {
        alert("Invalid project file: " + (e as Error).message);
      }
    }
  };

  const toggleAdvanced = () => {
    useApp.getState().updateSettings({ showAdvanced: !project.settings.showAdvanced });
  };

  const headerBg = dark ? "#0b1216" : "#0e7490";
  const headerBorder = dark ? "#164e63" : "#155e75";
  const inputBg = dark ? "#111a20" : "#ffffff";
  const inputColor = dark ? "#dff5fb" : "#0b3b48";
  const inputBorder = dark ? "#164e63" : "#b6dbe4";

  const btnStyle: React.CSSProperties = {
    padding: "4px 12px",
    border: dark ? "1px solid #164e63" : "1px solid rgba(255,255,255,0.4)",
    background: dark ? "#111a20" : "rgba(255,255,255,0.12)",
    color: "#ffffff",
    cursor: "pointer",
    borderRadius: 6,
    fontWeight: 600,
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        background: headerBg,
        color: "#ffffff",
        borderBottom: `1px solid ${headerBorder}`,
      }}
    >
      <strong style={{ letterSpacing: 0.4 }}>LEGO-Hub-blocks</strong>
      <input
        value={project.title}
        onChange={rename}
        style={{
          background: inputBg,
          color: inputColor,
          border: `1px solid ${inputBorder}`,
          padding: "4px 8px",
          borderRadius: 6,
          width: 220,
          outline: "none",
        }}
        aria-label="project title"
      />
      <button type="button" onClick={toggleType} style={btnStyle}>
        Mode: {project.type === "blocks" ? "Blocks" : "Python"}
      </button>
      {project.type === "blocks" && (
        <button type="button" onClick={toggleAdvanced} style={btnStyle}>
          {project.settings.showAdvanced ? "Advanced ✓" : "Advanced"}
        </button>
      )}
      <button type="button" onClick={openFile} style={btnStyle}>Open</button>
      <button type="button" onClick={() => downloadProject(project)} style={btnStyle}>Save</button>
      <button type="button" onClick={onOpenSettings} style={{ ...btnStyle, marginLeft: "auto" }}>Settings</button>
      {switchPrompt && (
        <SwitchToBlocksPrompt
          dark={dark}
          onCancel={() => setSwitchPrompt(false)}
          onDiscard={() => confirmSwitch("discard")}
          onBestEffort={() => confirmSwitch("best-effort")}
        />
      )}
    </header>
  );
}

interface PromptProps {
  dark: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onBestEffort: () => void;
}

function SwitchToBlocksPrompt({ dark, onCancel, onDiscard, onBestEffort }: PromptProps) {
  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: dark ? "rgba(0,0,0,0.6)" : "rgba(11, 59, 72, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };
  const modal: React.CSSProperties = {
    background: dark ? "#0b1216" : "#ffffff",
    color: dark ? "#dff5fb" : "#0b3b48",
    padding: 20,
    borderRadius: 12,
    maxWidth: 460,
    border: dark ? "1px solid #164e63" : "1px solid #b6dbe4",
    boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,111,143,0.25)",
  };
  const btn: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: 6,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid #155e75",
  };
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Switch to Blocks?</h3>
        <p style={{ fontSize: 14, lineHeight: 1.4 }}>
          Python source can't be translated back into blocks. Choose how to proceed:
        </p>
        <ul style={{ fontSize: 13, lineHeight: 1.5, paddingLeft: 18 }}>
          <li><strong>Best effort</strong> — keep the code inside a single "raw Python" block.</li>
          <li><strong>Discard</strong> — start with an empty blocks workspace.</li>
          <li><strong>Cancel</strong> — stay in Python mode.</li>
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onCancel} style={{ ...btn, background: "transparent", color: dark ? "#dff5fb" : "#0b3b48", border: `1px solid ${dark ? "#164e63" : "#b6dbe4"}` }}>
            Cancel
          </button>
          <button type="button" onClick={onDiscard} style={{ ...btn, background: "#b91c1c", color: "#fff", border: "1px solid #7f1d1d" }}>
            Discard
          </button>
          <button type="button" onClick={onBestEffort} style={{ ...btn, background: "#0e7490", color: "#fff" }}>
            Best effort
          </button>
        </div>
      </div>
    </div>
  );
}
