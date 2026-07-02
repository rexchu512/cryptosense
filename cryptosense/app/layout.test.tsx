import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// next/font/google cannot execute under vitest (needs Next's SWC transform),
// so we verify the font wiring at the source level; computed fonts are
// audited end-to-end via Playwright.
const src = readFileSync(resolve(__dirname, "layout.tsx"), "utf8");
const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

describe("RootLayout fonts", () => {
  it("loads Manrope / Plus Jakarta via next/font and wires their variables", () => {
    expect(src).toMatch(/Manrope/);
    expect(src).toMatch(/Plus_Jakarta_Sans/);
    expect(src).toMatch(/--font-sans/);
    expect(src).toMatch(/--font-heading/);
  });
  it("loads Noto Sans TC via stylesheet link (Turbopack CJK next/font workaround)", () => {
    // CJK 變體字體在 Turbopack 下無法用 next/font，改走 <link>
    expect(src).toMatch(/Noto\+Sans\+TC/);
    expect(src).not.toMatch(/Noto_Sans_TC/);
    expect(css).toMatch(/--font-tc:\s*"Noto Sans TC"/);
  });
});
