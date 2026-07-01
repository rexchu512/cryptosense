export function CitationPanel({ chunks }: { chunks: { text: string; source: string }[] }) {
  if (!chunks?.length) return null;
  return (
    <div className="mt-3 border-t border-hairline pt-2">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-on-dark-soft">資料來源（知識庫）</p>
      {chunks.map((c, i) => (
        <details key={i} className="mb-1 border-l-2 border-primary/70 pl-2 text-sm text-on-dark-soft">
          <summary className="cursor-pointer hover:text-on-dark">📚 {c.source}</summary>
          <blockquote className="ml-1 mt-1 text-xs text-on-dark-soft">{c.text}</blockquote>
        </details>
      ))}
    </div>
  );
}
