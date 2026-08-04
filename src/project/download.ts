import type { AnyProject } from "./format";
import { sanitizeFilename } from "../utils/sanitize";

export function downloadProject(project: AnyProject): void {
  const filename =
    sanitizeFilename(project.title) + (project.type === "blocks" ? ".blocksproj.json" : ".py");
  const content =
    project.type === "blocks"
      ? JSON.stringify(project, null, 0)
      : project.source;
  const blob = new Blob([content], {
    type: project.type === "blocks" ? "application/json" : "text/x-python",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
