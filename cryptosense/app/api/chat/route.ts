import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { runChat } from "@/lib/ai/chat";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, coinId } = await req.json();
  const result = await runChat({ messages, coinId });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: () => "分析時發生錯誤，請稍後再試。",
    }),
  });
}
