import { streamText, Output, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { CitedSource } from "./sources";

/**
 * The risk card: a structured second pass over an answer the model has already
 * given, rendered above the prose.
 *
 * Three properties are load-bearing and all three are structural rather than
 * instructions the model is asked to honour:
 *
 * 1. **No numeric field exists.** Every figure the card displays is filled by
 *    the server from tool output. The model literally has no slot to put a
 *    hallucinated price or loss into.
 * 2. **Style-bearing fields are enums.** Free text drifts to 「風險偏高」/
 *    「較高風險」/「偏高」 and the front-end switch falls through to its
 *    default, silently dropping the signal.
 * 3. **Sources are integer ids, never URLs.** The model cannot invent a link;
 *    an id that matches nothing simply renders without one.
 */

export const STANCES = ["偏高風險", "中性", "偏低風險"] as const;
export const CONFIDENCES = ["高", "中", "低"] as const;

const point = z.object({
  text: z
    .string()
    .min(4)
    .max(60)
    .describe("一句話，最多 60 字。只描述判斷，不要寫數字。"),
  sourceId: z
    .number()
    .int()
    .nullable()
    .describe("引用的來源編號；沒有對應來源就填 null，不要猜一個。"),
});

/**
 * Field order is display order: the object streams key by key, so putting
 * stance and confidence first lets the card header colour in within a few
 * hundred milliseconds instead of after the whole payload lands.
 */
export const riskCardSchema = z.object({
  stance: z.enum(STANCES).describe("整體風險定調，三選一。"),
  confidence: z.enum(CONFIDENCES).describe("你對這個定調的信心，三選一。"),
  headline: z
    .string()
    .min(8)
    .max(60)
    .describe("一句話結論，最多 60 字。不要出現數字，不要下買賣指令。"),
  pros: z.array(point).min(2).max(4).describe("正面觀點，2 到 4 條。"),
  risks: z.array(point).min(2).max(4).describe("風險與盲點，2 到 4 條。"),
});

export type RiskCard = z.infer<typeof riskCardSchema>;

export type RiskCardInput = {
  symbol: string;
  coinId: string;
  question: string;
  answer: string;
  sources: CitedSource[];
};

const KIND_LABEL: Record<CitedSource["kind"], string> = {
  market: "行情",
  news: "新聞",
  kb: "知識庫",
};

/**
 * Confidence has to be anchored to evidence. Left free, the model reported
 * 信心「高」 on a turn that retrieved nothing at all — on a card whose own
 * text said the basis was insufficient.
 */
function confidenceRule(sourceCount: number): string {
  if (sourceCount === 0) {
    return "這一輪**沒有取得任何來源**，判斷基礎不足，信心必須填「低」。";
  }
  if (sourceCount <= 2) {
    return "這一輪只取得少數來源，信心最高只能到「中」。";
  }
  return "只有在多個來源彼此一致時才填「高」；來源互相矛盾或涵蓋面不足時填「中」或「低」。";
}

export function buildRiskCardPrompt(input: RiskCardInput): string {
  const { symbol, coinId, question, answer, sources } = input;

  const sourceLines = sources.length
    ? sources.map((s) => `[${s.n}] （${KIND_LABEL[s.kind]}）${s.title} — ${s.meta}`).join("\n")
    : "（沒有可引用的來源）";
  const allowed = sources.length
    ? sources.map((s) => s.n).join("、")
    : "無——所有 sourceId 都必須填 null";

  return `你要把一段已經寫好的分析，整理成一張結構化的「進場前風險卡」。

標的：${symbol}（coinId：${coinId}）

使用者問的是：
${question}

已經產生的分析內容：
${answer}

可引用的來源（編號固定，不可更動）：
${sourceLines}

規則：
1. 你只做「整理與定調」，不做新的研究。**每一條都必須在上面的分析內容裡找得到對應的句子。**
   不要引入分析內容沒有提到的地區、機構、事件或說法——即使你認為那是常識。
   內容不足以寫滿 2 條時，就寫「可用資訊有限」這類誠實的描述，不要補一條看起來合理但沒有依據的。
2. **不要引用具體的價格、漲跌幅或金額。** 這些數字由系統另外填入卡片。
   （專有名詞裡本來就有的數字可以照寫，例如 Layer 2。）
3. sourceId 只能填這些編號其中之一：${allowed}。沒有對應來源就填 null，**不要猜、不要編**。
4. 正面觀點與風險各 2 到 4 條，每條一句話、最多 60 字。
5. **信心等級要反映證據多寡，不是反映你的語氣。**
   ${confidenceRule(sources.length)}
6. 不下買賣指令、不保證獲利、不報明牌。語氣冷靜中性。
7. 不使用 emoji。`;
}

/**
 * Second pass: turn the answer that was already produced into a structured
 * card. It deliberately does **not** call any tool — it works only from what
 * the first pass already retrieved, so it cannot introduce a fact that has no
 * source behind it.
 *
 * `streamObject` is deprecated in ai@7; the supported shape is `streamText`
 * with an `output` setting, read back via `partialOutputStream`.
 */
export function streamRiskCard({
  input,
  model,
}: {
  input: RiskCardInput;
  model?: LanguageModel;
}) {
  return streamText({
    model: model ?? openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
    output: Output.object({ schema: riskCardSchema, name: "risk_card" }),
    prompt: buildRiskCardPrompt(input),
  });
}
