import React, { useEffect, useRef, useState } from "react";

export function KeyboardMenu({ children, onClose, className = "", style, label = "Node actions", triggerRef }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    (ref.current?.querySelector('button:not(:disabled)') || ref.current)?.focus();
    const outside = event => { if (!ref.current?.contains(event.target) && !triggerRef?.current?.contains(event.target)) closeRef.current(); };
    document.addEventListener("mousedown", outside);
    return () => { document.removeEventListener("mousedown", outside); if (previous?.isConnected) previous.focus(); };
  }, [triggerRef]);
  return <div ref={ref} role="menu" tabIndex={-1} aria-label={label} className={className} style={style} onClick={event => { event.stopPropagation(); if (event.target.closest('button:not(:disabled)')) onClose(); }} onKeyDown={event => {
    event.stopPropagation();
    const buttons = Array.from(ref.current.querySelectorAll('button:not(:disabled)'));
    const current = buttons.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "Tab") onClose();
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index]?.focus();
    }
  }}>
    {React.Children.map(children, child => React.isValidElement(child) && child.type === "button" ? React.cloneElement(child, { role: "menuitem", tabIndex: -1 }) : child)}
  </div>;
}

export function ActionMenu({ label, children }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  return <div className="relative">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }} className="flex min-h-9 items-center gap-2 rounded-md border border-slate-700 bg-[#101419] px-3 py-2 text-xs text-slate-200">{label}</button>
    {open && <KeyboardMenu triggerRef={triggerRef} label={typeof label === "string" ? label : "Actions"} onClose={() => setOpen(false)} className="absolute right-0 top-11 z-50 grid w-56 gap-1 rounded-lg border border-slate-700 bg-[#101419] p-1.5 shadow-2xl">{children}</KeyboardMenu>}
  </div>;
}
