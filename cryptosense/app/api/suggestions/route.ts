import { buildSuggestions } from "@/lib/ai/suggestions";

export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const { coinId, symbol, lastUserText, lastAnswerText } = await req.json();
    if (coinId !== undefined && (typeof coinId !== "string" || coinId.length > 64)) {
      return Response.json({ error: "invalid coinId" }, { status: 400 });
    }
    if (symbol !== undefined && (typeof symbol !== "string" || symbol.length > 16)) {
      return Response.json({ error: "invalid symbol" }, { status: 400 });
    }
    if (lastUserText !== undefined && (typeof lastUserText !== "string" || lastUserText.length > 2000)) {
      return Response.json({ error: "invalid lastUserText" }, { status: 400 });
    }
    if (lastAnswerText !== undefined && (typeof lastAnswerText !== "string" || lastAnswerText.length > 8000)) {
      return Response.json({ error: "invalid lastAnswerText" }, { status: 400 });
    }
    const suggestions = await buildSuggestions({ coinId, symbol, lastUserText, lastAnswerText });
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] }, { status: 200 });
  }
}
