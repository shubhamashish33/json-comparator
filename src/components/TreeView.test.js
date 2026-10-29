import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TreeView } from "./TreeView";

test("tree containers can be selected and expanded with a keyboard", () => {
  const onSelect = jest.fn();
  render(<TreeView value={{ profile: { name: "Ada" } }} selectedPath="" selectedPaths={new Set()} matches={new Set()} onSelect={onSelect} onContextMenu={() => {}} />);
  const root = screen.getByRole("button", { name: "root: object" });
  expect(root.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(root, { key: "Enter" });
  expect(root.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "profile: object" })).toBeNull();
  fireEvent.keyDown(root, { key: " " });
  expect(screen.getByRole("button", { name: "profile: object" })).toBeTruthy();
  expect(onSelect).toHaveBeenCalledTimes(2);
});
