import type { AnyProject } from "./format";

const KEY_AUTOSAVE = "lhb.autosave";
const KEY_LAST_DEVICE = "lhb.lastDeviceName";

export function loadAutosave(): AnyProject | null {
  try {
    const raw = localStorage.getItem(KEY_AUTOSAVE);
    if (!raw) return null;
    return JSON.parse(raw) as AnyProject;
  } catch {
    return null;
  }
}

export function saveAutosave(project: AnyProject): void {
  try {
    localStorage.setItem(KEY_AUTOSAVE, JSON.stringify(project));
  } catch {
    // storage quota — silent
  }
}

export function loadLastDeviceName(): string | null {
  return localStorage.getItem(KEY_LAST_DEVICE);
}

export function saveLastDeviceName(name: string): void {
  localStorage.setItem(KEY_LAST_DEVICE, name);
}
