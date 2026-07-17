import Editor from "@monaco-editor/react";

interface Props {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}

export function MonacoView({ value, language = "python", readOnly = false, onChange }: Props) {
  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
      }}
    />
  );
}
