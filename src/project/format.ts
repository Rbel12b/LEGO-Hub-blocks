export type ProjectType = "blocks" | "python";

export type LspMode = "off" | "worker" | "remote";

export interface ProjectSettings {
  showAdvanced: boolean;
  allowRoot: boolean;
  autoRunAfterUpload: boolean;
  autoreloadInLive: boolean;
  lspMode: LspMode;
  lspRemoteUrl: string;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  showAdvanced: false,
  allowRoot: false,
  autoRunAfterUpload: true,
  autoreloadInLive: false,
  lspMode: "worker",
  lspRemoteUrl: "ws://localhost:3001",
};

export interface BlocksProject {
  format: "lego-hub-blocks";
  version: 1;
  type: "blocks";
  title: string;
  createdAt: string;
  settings: ProjectSettings;
  workspace: unknown; // Blockly JSON serialization
}

export interface PythonProject {
  format: "lego-hub-blocks";
  version: 1;
  type: "python";
  title: string;
  createdAt: string;
  settings: ProjectSettings;
  source: string;
}

export type AnyProject = BlocksProject | PythonProject;

export function newBlocksProject(title = "Untitled"): BlocksProject {
  return {
    format: "lego-hub-blocks",
    version: 1,
    type: "blocks",
    title,
    createdAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: "on_program_start", x: 40, y: 40 }],
      },
    },
  };
}

export function newPythonProject(title = "Untitled"): PythonProject {
  return {
    format: "lego-hub-blocks",
    version: 1,
    type: "python",
    title,
    createdAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    source: "# lego-hub-blocks: python v1\n",
  };
}
