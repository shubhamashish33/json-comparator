import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkflowDemo } from "./WorkflowDemo";

test("demonstrates matching reordered records and ignoring timestamps", () => {
  render(<WorkflowDemo />);
  expect(screen.getByRole("status").textContent).toContain("1 meaningful change");
  expect(screen.getByRole("status").textContent).toContain("pending → shipped");
  fireEvent.click(screen.getByRole("checkbox", { name: "Ignore updatedAt" }));
  expect(screen.getByRole("status").textContent).toContain("2 meaningful changes");
  expect(screen.getByRole("status").textContent).toContain("updatedAt");
});
test("demonstrates redaction without leaving the page", () => {
  render(<WorkflowDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Sanitize secrets" }));
  expect(screen.getByRole("status").textContent).toContain("2 sensitive values replaced");
  expect(screen.getByText(/\[REDACTED\]/).textContent).toContain('"name": "Ada"');
});
