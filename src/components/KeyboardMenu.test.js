import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionMenu } from "./KeyboardMenu";

test("menus navigate enabled actions and restore trigger focus", () => {
  const run = jest.fn();
  render(<ActionMenu label="More"><button disabled>Unavailable</button><button onClick={run}>Format</button><button>Copy</button></ActionMenu>);
  const trigger = screen.getByRole("button", { name: "More" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Format" }));
  fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy" }));
  fireEvent.keyDown(document.activeElement, { key: "Home" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Format" }));
  fireEvent.click(document.activeElement);
  expect(run).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("an all-disabled menu can still close with Escape", () => {
  render(<ActionMenu label="Export"><button disabled>Download</button></ActionMenu>);
  const trigger = screen.getByRole("button", { name: "Export" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole("menu"));
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
test("clicking an open menu trigger closes it without reopening", () => {
  render(<ActionMenu label="More"><button>Format</button></ActionMenu>);
  const trigger = screen.getByRole("button", { name: "More" });
  fireEvent.click(trigger);
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  expect(screen.queryByRole("menu")).toBeNull();
});
