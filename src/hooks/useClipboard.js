import { useCallback, useEffect, useRef, useState } from "react";

const copyLabels = {
  key: "Key", path: "Path", value: "Value", left: "JSON",
  query: "Query result", redacted: "Redacted JSON",
};

export const useClipboard = () => {
  const [copied, setCopied] = useState("");
  const [notification, setNotification] = useState(null);
  const timer = useRef(null);
  const request = useRef(0);

  const dismiss = useCallback(() => {
    request.current += 1;
    clearTimeout(timer.current);
    setNotification(null);
    setCopied("");
  }, []);

  useEffect(() => () => {
    request.current += 1;
    clearTimeout(timer.current);
  }, []);

  const copyText = useCallback(async (text, type) => {
    const id = ++request.current;
    clearTimeout(timer.current);
    setCopied("");
    setNotification(null);
    try {
      await navigator.clipboard.writeText(text);
      if (id !== request.current) return;
      setCopied(type);
      setNotification({ id, tone: "success", message: `${copyLabels[type] || "Text"} copied to clipboard` });
      timer.current = setTimeout(dismiss, 3000);
    } catch {
      if (id !== request.current) return;
      setNotification({ id, tone: "error", message: "Couldn’t copy. Select the text and copy it manually." });
      timer.current = setTimeout(dismiss, 5000);
    }
  }, [dismiss]);

  return { copied, notification, copyText, dismiss };
};
