import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders GFM structure (list, heading, table) inside .answer", () => {
    const md = "## 標題\n\n- 甲\n- 乙\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<Markdown>{md}</Markdown>);
    expect(container.querySelector(".answer")).toBeTruthy();
    expect(container.querySelector("h2")).toBeTruthy();
    expect(container.querySelectorAll("li").length).toBe(2);
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("does not carry the (no-op) prose-invert wrapper anymore", () => {
    const { container } = render(<Markdown>{"x"}</Markdown>);
    expect(container.querySelector(".prose-invert")).toBeNull();
  });
});
