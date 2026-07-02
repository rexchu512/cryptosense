import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

describe(".answer typography", () => {
  it("restores list markers and breathing room stripped by Preflight", () => {
    expect(css).toMatch(/\.answer\{[\s\S]*line-height:\s*1\.85/);
    expect(css).toMatch(/\.answer :where\(ul\)\{[\s\S]*list-style:\s*disc/);
    expect(css).toMatch(/\.answer :where\(li::marker\)/);
    expect(css).toMatch(/\.answer :where\(table\)/);
  });
  it("uses design-system brand tokens (teal), not Coinbase blue", () => {
    expect(css).toMatch(/--cb-primary:\s*#007583/);
    expect(css).not.toMatch(/--cb-primary:\s*#0052ff/);
  });
});
