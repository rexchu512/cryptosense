export type CitedSource = {
  n: number;
  kind: "market" | "news" | "kb";
  title: string;
  url?: string;
  meta: string; // 顯示用副述（來源+時間/段落）
  snippet?: string; // KB 片段全文，供 SourceTray「展開片段」就地展開
};

export function createSourceRegistry() {
  const items: CitedSource[] = [];
  return {
    add(s: Omit<CitedSource, "n">): CitedSource {
      const cited = { n: items.length + 1, ...s };
      items.push(cited);
      return cited;
    },
    list(): CitedSource[] {
      return items;
    },
  };
}
