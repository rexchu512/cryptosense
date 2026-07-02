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

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/coin/${id}`);
  };

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
    <header className="flex h-14 items-center justify-between gap-4 border-b border-hairline bg-canvas px-5">
      <Link href="/" className="shrink-0 text-[15px] font-bold text-ink">
        Crypto<span className="text-cb-primary">Sense</span>
      </Link>
      <nav className="hidden gap-5 text-[13px] text-body sm:flex">
        <Link href="/">市場</Link>
      </nav>
      <div className="relative w-56">
        <input
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
          className="w-full rounded-md border border-hairline px-3 py-1.5 text-[12px] text-ink placeholder:text-cb-muted"
        />
        {open && results.length > 0 && (
          <ul
            id="topbar-search-listbox"
            role="listbox"
            // Prevent the input from ever blurring when a result is clicked —
            // preventing mousedown's default action stops the browser's
            // implicit focus shift, so there's no race against onBlur to win.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-hairline bg-canvas py-1 shadow-lg"
          >
            {results.map((c, i) => (
              <li key={c.id} role="presentation">
                <button
                  type="button"
                  id={`topbar-option-${c.id}`}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  onClick={() => go(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-ink hover:bg-soft ${
                    i === highlightedIndex ? "bg-soft" : ""
                  }`}
                >
                  <CoinIcon image={c.image} symbol={c.symbol} size={18} />
                  <span>{c.name}</span>
                  <span className="text-cb-muted">{c.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
