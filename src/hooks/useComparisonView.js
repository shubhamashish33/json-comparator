import { useEffect, useState } from "react";

// Selecting Tree expresses an intent to compare, even if parsing is still
// debounced. Wait for parsing before running against the current documents.
export const useComparisonView = ({ setMode, parsing, busy, complete, runCompare }) => {
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!requested || parsing || busy) return;
    setRequested(false);
    runCompare();
  }, [requested, parsing, busy, runCompare]);

  return (mode) => {
    setMode(mode);
    setRequested(mode === "tree" && !busy && !complete);
  };
};
