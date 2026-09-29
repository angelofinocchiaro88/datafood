import { NextResponse } from "next/server";
import { checkOllama, getRecommendedModel, formatModelSize } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkOllama();

  if (!status.running) {
    return NextResponse.json({
      running: false,
      error: status.error || "Ollama non rilevato",
      message: "Ollama non è in esecuzione. Scarica Ollama da https://ollama.com e avvialo.",
    });
  }

  return NextResponse.json({
    running: true,
    models: status.models?.map((m) => ({
      name: m.name,
      size: formatModelSize(m.size),
      sizeBytes: m.size,
      modified: m.modified_at,
    })),
    recommended: getRecommendedModel(status.models || []),
    modelCount: status.models?.length || 0,
  });
}