import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./prompt";
import { makeCryptoTools } from "./tools";
import { createSourceRegistry } from "./sources";

export function buildTurnSystem(messages: UIMessage[], ctx: { coinId?: string; symbol?: string }): string {
  const base = buildSystemPrompt(ctx);
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > 0 && userTurns % 3 === 0) {
    return base + "\n\n提醒：本輪回答仍必須使用上述 Markdown 結構（結論先行、清單/表格）與 [n] 引用格式。";
  }
  return base;
}

export async function runChat({ messages, coinId, symbol, model }: {
  messages: UIMessage[]; coinId?: string; symbol?: string; model?: LanguageModel;
}) {
  const registry = createSourceRegistry();
  return streamText({
    model: model ?? openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
    system: buildTurnSystem(messages, { coinId, symbol }),
    messages: await convertToModelMessages(messages),
    tools: makeCryptoTools({ coinId, symbol }, registry),
    stopWhen: stepCountIs(6),
  });
}
