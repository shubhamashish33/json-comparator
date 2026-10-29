import React, { useCallback, useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";

// Monaco exposes edits through the two inner editors, rather than an onChange
// prop on DiffEditor. Ignore controlled updates so selecting a saved document
// does not accidentally turn it into temporary input.
export const EditableDiff = ({ left, right, onLeftChange, onRightChange }) => {
  const latest = useRef();
  latest.current = { left, right, onLeftChange, onRightChange };
  const subscriptions = useRef([]);
  const dispose = useCallback(() => {
    subscriptions.current.forEach((subscription) => subscription.dispose());
    subscriptions.current = [];
  }, []);
  useEffect(() => dispose, [dispose]);

  const onMount = useCallback((editor) => {
    dispose();
    const subscribe = (side, innerEditor, callback) => innerEditor.onDidChangeModelContent(() => {
      const value = innerEditor.getValue();
      if (value === latest.current[side]) return;
      latest.current[side] = value;
      latest.current[callback](value);
    });
    subscriptions.current = [
      subscribe("left", editor.getOriginalEditor(), "onLeftChange"),
      subscribe("right", editor.getModifiedEditor(), "onRightChange"),
    ];
  }, [dispose]);

  return (
    <DiffEditor
      height="min(65vh, 42rem)"
      language="json"
      theme="vs-dark"
      original={left}
      modified={right}
      onMount={onMount}
      options={{
        readOnly: false,
        originalEditable: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        fontSize: 13,
        tabSize: 2,
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        originalAriaLabel: "Left JSON",
        modifiedAriaLabel: "Right JSON",
      }}
    />
  );
};
