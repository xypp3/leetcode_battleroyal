import { useState } from "react";
import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export function CodeEditor({ code, onChange }: CodeEditorProps) {
  const [isEditorReady, setIsEditorReady] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-600 bg-gray-900">
      <Editor
        height="500px"
        defaultLanguage="javascript"
        value={code}
        onChange={handleEditorChange}
        onMount={() => setIsEditorReady(true)}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "on",
          formatOnPaste: true,
          formatOnType: true,
          padding: { top: 16, bottom: 16 },
        }}
      />
      {!isEditorReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-gray-400">Loading editor...</div>
        </div>
      )}
    </div>
  );
}
