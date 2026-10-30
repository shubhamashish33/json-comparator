import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageMetadata } from "./PageMetadata";
import { FormatExample, ToolPage } from "./ToolPage";
import { toolPages, SITE_URL } from "../pageMetadata";

test("formatter validates and blocks unsafe IDs without changing input", () => {
  render(<FormatExample />);
  fireEvent.click(screen.getByRole("button", { name: "Format example" }));
  expect(screen.getByLabelText("Formatted JSON").textContent).toContain('"service": "orders"');
  fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"id":9007199254740993}' } });
  fireEvent.click(screen.getByRole("button", { name: "Format example" }));
  expect(screen.getByRole("alert").textContent).toContain("safe numeric precision");
  expect(screen.getByRole("textbox").value).toBe('{"id":9007199254740993}');
});
test.each(toolPages)("$path has unique metadata, useful content and a workspace link", page => {
  document.head.innerHTML = '<meta name="description" content=""><link rel="canonical" href="">';
  render(<MemoryRouter initialEntries={[page.path]}><PageMetadata /><ToolPage page={page} /></MemoryRouter>);
  expect(document.title).toBe(page.title);
  expect(document.querySelector('link[rel="canonical"]').href).toBe(SITE_URL + page.path);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(page.heading);
  expect(screen.getByRole("link", { name: "Open workspace" }).getAttribute("href")).toBe(page.target);
});
