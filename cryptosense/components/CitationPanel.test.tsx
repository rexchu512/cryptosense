import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CitationPanel } from "./CitationPanel";

describe("CitationPanel", () => {
  it("renders filename and expandable original text", () => {
    render(<CitationPanel chunks={[{ text: "ETH 解鎖事件原文", source: "eth-notes.md" }]} />);
    expect(screen.getByText(/eth-notes\.md/)).toBeInTheDocument();
    expect(screen.getByText(/ETH 解鎖事件原文/)).toBeInTheDocument();
    expect(screen.getByText(/資料來源/)).toBeInTheDocument();
  });
  it("renders nothing when no chunks", () => {
    const { container } = render(<CitationPanel chunks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
