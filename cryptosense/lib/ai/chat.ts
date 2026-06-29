import { streamText, isStepCount, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "./prompt";
import { cryptoTools } from "./tools";

export async function runChat({ messages, coinId, model }: { messages: UIMessage[]; coinId?: string; model?: LanguageModel }) {
  const system = coinId ? `${SYSTEM_PROMPT}\n\n目前使用者正在看的幣 id：${coinId}` : SYSTEM_PROMPT;
  const modelMessages = await convertToModelMessages(messages);
  return streamText({
    model: model ?? openai("gpt-4o"),
    system,
    messages: modelMessages,
    tools: cryptoTools,
    stopWhen: isStepCount(6),
  });
}
