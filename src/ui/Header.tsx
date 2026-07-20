import { useApp } from "../state/store";
import { downloadProject, pickFile } from "../project/download";
import type { AnyProject } from "../project/format";
import { newBlocksProject, newPythonProject } from "../project/format";

interface Props {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: Props) {
  const { project, setProject } = useApp();
  const dark = project.type === "python";

  const rename = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProject({ ...project, title: e.target.value });
  };

  const toggleType = () => {
    setProject(
      project.type === "blocks"
        ? { ...newPythonProject(project.title), settings: project.settings }
        : { ...newBlocksProject(project.title), settings: project.settings },
    );
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
    </header>
  );
}
