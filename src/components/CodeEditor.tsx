import { useState } from "react";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export function CodeEditor({ code, onChange }: CodeEditorProps) {
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);

  const updateLineNumbers = (text: string) => {
    const lines = text.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    onChange(newCode);
    updateLineNumbers(newCode);
  };

  // Initialize line numbers
  if (lineNumbers.length === 0 && code) {
    updateLineNumbers(code);
  }

  return (
    <div className="relative">
      <div className="flex bg-gray-900 rounded-lg overflow-hidden border border-gray-600">
        {/* Line Numbers */}
        <div className="bg-gray-800 px-3 py-4 text-gray-500 text-sm font-mono select-none">
          {lineNumbers.map((num) => (
            <div key={num} className="leading-6">
              {num}
            </div>
          ))}
        </div>
        
        {/* Code Input */}
        <textarea
          value={code}
          onChange={handleChange}
          className="flex-1 bg-gray-900 text-white font-mono text-sm p-4 resize-none outline-none leading-6"
          rows={20}
          placeholder="// Write your solution here..."
          spellCheck={false}
          style={{
            tabSize: 2,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newCode = code.substring(0, start) + '  ' + code.substring(end);
              onChange(newCode);
              
              // Set cursor position after the inserted spaces
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
              }, 0);
            }
          }}
        />
      </div>
      
      {/* Syntax highlighting hint */}
      <div className="absolute top-2 right-2 bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
        JavaScript
      </div>
    </div>
  );
}
