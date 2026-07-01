import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./prompt";
import { makeCryptoTools } from "./tools";

export async function runChat({ messages, coinId, symbol, model }: {
  messages: UIMessage[]; coinId?: string; symbol?: string; model?: LanguageModel;
}) {
  return streamText({
    model: model ?? openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
    system: buildSystemPrompt({ coinId, symbol }),
    messages: await convertToModelMessages(messages),
    tools: makeCryptoTools({ coinId, symbol }),
    stopWhen: stepCountIs(6),
  });
}
