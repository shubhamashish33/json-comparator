import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette, filterPaletteItems } from "./CommandPalette";

const items = [
  { id: "format", group: "Commands", label: "Format JSON", run: jest.fn() },
  { id: "repair", group: "Commands", label: "Repair JSON", disabled: true, run: jest.fn() },
  { id: "doc", group: "Documents", label: "example.json", run: jest.fn() },
  { id: "path", group: "JSON", label: "profile.name", description: "Ada", run: jest.fn() },
];
beforeEach(() => jest.clearAllMocks());
test("searches values and restricts results by prefix", () => {
  expect(filterPaletteItems(items, "ada").map(item => item.id)).toEqual(["path"]);
  expect(filterPaletteItems(items, "> JSON").map(item => item.id)).toEqual(["format", "repair"]);
  expect(filterPaletteItems(items, "@ example").map(item => item.id)).toEqual(["doc"]);
  expect(filterPaletteItems(items, "# profile").map(item => item.id)).toEqual(["path"]);
});
test("supports keyboard selection without running disabled commands", () => {
  const close = jest.fn();
  render(<CommandPalette items={items} onClose={close} />);
  const input = screen.getByRole("combobox");
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(items[1].run).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(items[2].run).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
test("traps Tab, closes on Escape, and restores trigger focus", () => {
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  trigger.focus();
  const close = jest.fn();
  const { unmount } = render(<CommandPalette items={items} onClose={close} />);
  const input = screen.getByRole("combobox");
  fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close search" }));
  fireEvent.keyDown(document.activeElement, { key: "Tab" });
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(1);
  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
