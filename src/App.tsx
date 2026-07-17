import { useEffect, useState } from "react";
import { Header } from "./ui/Header";
import { DeviceBar } from "./ui/DeviceBar";
import { Workspace } from "./ui/Workspace";
import { SettingsModal } from "./ui/SettingsModal";
import { useApp } from "./state/store";
import { loadAutosave, saveAutosave } from "./project/storage";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const project = useApp((s) => s.project);
  const setProject = useApp((s) => s.setProject);

  useEffect(() => {
    const saved = loadAutosave();
    if (saved) setProject(saved);
  }, [setProject]);

  useEffect(() => {
    const id = setInterval(() => saveAutosave(useApp.getState().project), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f0f10" }}>
      <Header onOpenSettings={() => setShowSettings(true)} />
      <DeviceBar />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Workspace key={project.type} />
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
