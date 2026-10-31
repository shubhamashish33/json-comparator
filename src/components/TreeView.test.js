import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TreeView } from "./TreeView";

test("tree containers can be selected and expanded with a keyboard", () => {
  const onSelect = jest.fn();
  render(<TreeView value={{ profile: { name: "Ada" } }} selectedPath="" selectedPaths={new Set()} matches={new Set()} onSelect={onSelect} onContextMenu={() => {}} />);
  const root = screen.getByRole("treeitem", { name: "root: object" });
  expect(root.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(root, { key: "Enter" });
  expect(root.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("treeitem", { name: "profile: object" })).toBeNull();
  fireEvent.keyDown(root, { key: " " });
  expect(screen.getByRole("treeitem", { name: "profile: object" })).toBeTruthy();
  expect(onSelect).toHaveBeenCalledTimes(2);
});

test("arrows navigate visible nodes, expand and collapse, and expose one tab stop", () => {
  render(<TreeView value={{ profile: { name: "Ada" }, active: true }} selectedPath="" selectedPaths={new Set()} matches={new Set()} onSelect={() => {}} onContextMenu={() => {}} />);
  const root = screen.getByRole("treeitem", { name: "root: object" });
  root.focus();
  fireEvent.keyDown(root, { key: "ArrowRight" });
  const profile = screen.getByRole("treeitem", { name: "profile: object" });
  expect(document.activeElement).toBe(profile);
  fireEvent.keyDown(profile, { key: "ArrowRight" });
  const name = screen.getByRole("treeitem", { name: "profile.name: string" });
  expect(document.activeElement).toBe(name);
  fireEvent.keyDown(name, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(profile);
  fireEvent.keyDown(profile, { key: "ArrowLeft" });
  expect(screen.queryByRole("treeitem", { name: "profile.name: string" })).toBeNull();
  fireEvent.keyDown(profile, { key: "End" });
  expect(document.activeElement).toBe(screen.getByRole("treeitem", { name: "active: boolean" }));
  fireEvent.keyDown(document.activeElement, { key: "Home" });
  expect(document.activeElement).toBe(root);
  expect(screen.getAllByRole("treeitem").filter(node => node.tabIndex === 0)).toHaveLength(1);
});
test("Shift+F10 opens node actions at the focused row", () => {
  const context = jest.fn();
  render(<TreeView value={{ name: "Ada" }} selectedPath="" selectedPaths={new Set()} matches={new Set()} onSelect={() => {}} onContextMenu={context} />);
  fireEvent.keyDown(screen.getByRole("treeitem", { name: "name: string" }), { key: "F10", shiftKey: true });
  expect(context.mock.calls[0][0]).toBe("name");
});
