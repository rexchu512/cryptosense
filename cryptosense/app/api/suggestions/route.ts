import { buildSuggestions } from "@/lib/ai/suggestions";

export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const { coinId, symbol, lastUserText, lastAnswerText } = await req.json();
    const suggestions = await buildSuggestions({ coinId, symbol, lastUserText, lastAnswerText });
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] }, { status: 200 });
  }
}
