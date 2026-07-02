"use client";
import { Streamdown } from "streamdown";

// Streamdown = drop-in for react-markdown, purpose-built for AI streaming:
// built-in remark-gfm/rehype, graceful incomplete-markdown parsing, and
// internal incremental memoization. Styling comes from the scoped `.answer`
// typography in globals.css (the old `prose prose-invert` was a no-op because
// @tailwindcss/typography was never installed).
//
// linkSafety is disabled so citation anchors (`[n]` → `#cs-n`, produced by
// Chat's linkifyCitations) render as real <a> anchors and jump to the source
// row, instead of Streamdown's confirm-popover <button> which breaks in-page
// anchor navigation.
export function Markdown({ children }: { children: string }) {
  return (
    <Streamdown className="answer" linkSafety={{ enabled: false }}>
      {children}
    </Streamdown>
  );
}
