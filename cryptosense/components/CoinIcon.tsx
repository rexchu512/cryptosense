"use client";
import { useState } from "react";

export function CoinIcon({ image, symbol, size = 22 }: { image?: string; symbol: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!image || broken) {
    return (
      <span
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-soft font-semibold text-cb-muted"
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={symbol}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      onError={() => setBroken(true)}
    />
  );
}
