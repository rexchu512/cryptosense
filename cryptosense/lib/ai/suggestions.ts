import "server-only";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { LanguageModel } from "ai";

const Schema = z.object({ suggestions: z.array(z.string()).length(3) });
const defaults = (symbol = "此幣") => [`${symbol} 主要下行風險？`, `${symbol} 對比大盤/BTC 如何？`, `${symbol} 最新利空新聞？`];

export async function buildSuggestions(opts: {
  coinId?: string; symbol?: string; lastUserText?: string; lastAnswerText?: string; model?: LanguageModel;
}): Promise<string[]> {
  const symbol = opts.symbol ?? "此幣";
  try {
    const { output } = await generateText({
      model: opts.model ?? openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      output: Output.object({ schema: Schema }),
      prompt: `針對加密貨幣 ${symbol} 的風險研究對話，產生「正好 3 個」精簡、可點擊的後續追問（繁中、各≤16字、聚焦 ${symbol}、可對照大盤/BTC、避免重複）。
使用者剛問：「${opts.lastUserText ?? ""}」
AI 剛答（節錄）：「${(opts.lastAnswerText ?? "").slice(0, 400)}」`,
    });
    const s = output?.suggestions ?? [];
    return s.length === 3 ? s : defaults(symbol);
  } catch {
    return defaults(symbol);
  }
}
