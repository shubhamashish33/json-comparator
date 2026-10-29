import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeDialog } from "./NodeDialog";

test("edits a typed value through labeled controls", () => {
  const onSave = jest.fn();
  render(<NodeDialog mode="add" onSave={onSave} onClose={() => {}} parentPath="profile" />);
  expect(screen.getByRole("dialog", { name: "Add node" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Key"), { target: { value: "age" } });
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "number" } });
  fireEvent.change(screen.getByLabelText("Value"), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSave).toHaveBeenCalledWith({ key: "age", value: 42, parentPath: "profile" });
});

test("traps keyboard focus, closes with Escape and restores the trigger", () => {
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  trigger.focus();
  const onClose = jest.fn();
  const { unmount } = render(<NodeDialog mode="add" onSave={() => {}} onClose={onClose} />);
  const close = screen.getByRole("button", { name: "Close dialog" });
  const save = screen.getByRole("button", { name: "Save" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(save);
  fireEvent.keyDown(save, { key: "Tab" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
