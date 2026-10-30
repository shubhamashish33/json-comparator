import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePaletteShortcut } from "./usePaletteShortcut";

function Harness({ onOpen }) {
  usePaletteShortcut(onOpen);
  return <textarea aria-label="Editor" onKeyDown={event => { event.preventDefault(); event.stopPropagation(); }} />;
}

test.each([{ ctrlKey: true }, { metaKey: true }])("opens before an editor consumes the shortcut: %j", modifier => {
  const onOpen = jest.fn();
  const { unmount } = render(<Harness onOpen={onOpen} />);
  const editor = screen.getByRole("textbox");
  editor.focus();
  fireEvent.keyDown(editor, { key: "k", ...modifier });
  expect(onOpen).toHaveBeenCalledTimes(1);
  unmount();
  fireEvent.keyDown(window, { key: "k", ...modifier });
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("preserves other editor keys and does not open over a modal", () => {
  const onOpen = jest.fn();
  render(<Harness onOpen={onOpen} />);
  const editor = screen.getByRole("textbox");
  fireEvent.keyDown(editor, { key: "k" });
  fireEvent.keyDown(editor, { key: "k", ctrlKey: true, shiftKey: true });
  fireEvent.keyDown(editor, { key: "f", ctrlKey: true });
  const modal = document.createElement("div");
  modal.setAttribute("aria-modal", "true");
  document.body.appendChild(modal);
  fireEvent.keyDown(editor, { key: "k", ctrlKey: true });
  modal.remove();
  expect(onOpen).not.toHaveBeenCalled();
});
