"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoinIcon } from "./CoinIcon";
import type { CoinSearchResult } from "@/lib/tools/search";

const DEBOUNCE_MS = 250;

export function TopBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          setResults(Array.isArray(data?.data) ? data.data : []);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setOpen(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Reset the keyboard highlight whenever the result set changes.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/coin/${id}`);
  };

  // Keyboard navigation for the search combobox (ArrowDown/Up move the
  // highlight, Enter navigates to the highlighted result, Escape closes).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        go(results[highlightedIndex].id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/60 bg-canvas/75 shadow-sm backdrop-blur-md backdrop-saturate-150">
      <div className="cs-wrap flex h-16 items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-glow/20" />
          <span className="font-heading text-[16px] font-extrabold text-ink">
            Crypto<span className="text-brand-strong">Sense</span>
          </span>
        </Link>

        {/* Nav (desktop). Only 市場 is a real link — 幣種/知識庫 are deliberately
            NOT links (no dead placeholders): 幣種 focuses the search box,
            知識庫 is a "coming soon" label. */}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className="rounded-full bg-cb-primary-soft px-3.5 py-2 text-[14px] font-semibold text-indigo"
          >
            市場
          </Link>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="rounded-full px-3.5 py-2 text-[14px] font-medium text-body transition-colors hover:bg-brand/10"
          >
            幣種
          </button>
          <span className="flex cursor-default items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium text-cb-muted">
            知識庫
            <span className="rounded-full bg-strong px-1.5 py-0.5 text-[9.5px] tracking-wide">
              即將推出
            </span>
          </span>
        </nav>

        {/* Search */}
        <div className="relative ml-auto w-44 sm:w-64">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-cb-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
            placeholder="搜尋幣種或代號..."
            aria-label="搜尋幣種或代號"
            role="combobox"
            aria-expanded={open}
            aria-controls="topbar-search-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              highlightedIndex >= 0 && highlightedIndex < results.length
                ? `topbar-option-${results[highlightedIndex].id}`
                : undefined
            }
            className="h-9 w-full rounded-full border border-hairline bg-canvas/70 pl-9 pr-3 text-[13px] text-ink placeholder:text-cb-muted focus:border-glow focus:outline-none focus:ring-2 focus:ring-glow/20"
          />
          {open && results.length > 0 && (
            <ul
              id="topbar-search-listbox"
              role="listbox"
              // Prevent the input from blurring when a result is clicked —
              // preventing mousedown's default stops the implicit focus shift,
              // so there's no race against onBlur.
              onMouseDown={(e) => e.preventDefault()}
              className="absolute right-0 top-full z-10 mt-1.5 w-72 rounded-xl border border-hairline bg-canvas py-1.5 shadow-lg"
            >
              {results.map((c, i) => (
                <li key={c.id} role="presentation">
                  <button
                    type="button"
                    id={`topbar-option-${c.id}`}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    onClick={() => go(c.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] text-ink hover:bg-soft ${
                      i === highlightedIndex ? "bg-soft" : ""
                    }`}
                  >
                    <CoinIcon image={c.image} symbol={c.symbol} size={20} />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-cb-muted">{c.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
