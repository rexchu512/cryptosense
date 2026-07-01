import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { runChat } from "@/lib/ai/chat";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, coinId, symbol } = await req.json();
    if (!Array.isArray(messages)) {
      return Response.json({ error: "messages must be an array" }, { status: 400 });
    }
    if (coinId !== undefined && (typeof coinId !== "string" || coinId.length > 64)) {
      return Response.json({ error: "invalid coinId" }, { status: 400 });
    }
    if (symbol !== undefined && (typeof symbol !== "string" || symbol.length > 16)) {
      return Response.json({ error: "invalid symbol" }, { status: 400 });
    }
    const result = await runChat({ messages, coinId, symbol });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: () => "分析時發生錯誤，請稍後再試。",
      }),
    });
  } catch {
    return Response.json({ error: "分析時發生錯誤，請稍後再試。" }, { status: 500 });
  }
}
