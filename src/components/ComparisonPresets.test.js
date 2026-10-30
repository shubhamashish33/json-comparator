import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComparisonPresets } from "./ComparisonPresets";
import { STORAGE_KEYS, defaultSettings } from "../workbenchConfig";
import { readComparisonPresets } from "../comparisonPresets";
import { setRememberWorkspace } from "../workspacePrivacy";
function Harness({ remember = true }) {
  const [settings, setSettings] = useState(defaultSettings);
  return <ComparisonPresets settings={settings} onChange={setSettings} remember={remember} />;
}
beforeEach(() => localStorage.clear());
test("applies, saves, restores and deletes named comparison rules", () => {
  const { unmount } = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "API responses" }));
  fireEvent.click(screen.getByText("Customize rules & save a preset"));
  expect(screen.getByLabelText("Record match key").value).toBe("id");
  fireEvent.change(screen.getByLabelText("Record match key"), { target: { value: "uuid" } });
  fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Orders" } });
  fireEvent.click(screen.getByRole("button", { name: "Save current rules" }));
  expect(readComparisonPresets(STORAGE_KEYS.presets)[0].settings.arrayMatchKey).toBe("uuid");
  unmount();
  render(<Harness />);
  fireEvent.click(screen.getByText("Customize rules & save a preset"));
  fireEvent.click(screen.getByRole("button", { name: "Apply Orders" }));
  expect(screen.getByLabelText("Record match key").value).toBe("uuid");
  fireEvent.click(screen.getByRole("button", { name: "Delete preset Orders" }));
  expect(readComparisonPresets(STORAGE_KEYS.presets)).toEqual([]);
});
test("memory-only mode does not persist presets and clearing workspace removes them", () => {
  localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify([{ name: "Private", settings: defaultSettings }]));
  setRememberWorkspace(false);
  render(<Harness remember={false} />);
  fireEvent.click(screen.getByText("Customize rules & save a preset"));
  fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Session" } });
  fireEvent.click(screen.getByRole("button", { name: "Save current rules" }));
  expect(screen.getByRole("button", { name: "Apply Session" })).toBeTruthy();
  expect(localStorage.getItem(STORAGE_KEYS.presets)).toBeNull();
});
test("malformed saved presets do not break the toolbar", () => {
  localStorage.setItem(STORAGE_KEYS.presets, '{broken');
  expect(readComparisonPresets(STORAGE_KEYS.presets)).toEqual([]);
});
