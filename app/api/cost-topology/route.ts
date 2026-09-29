import { NextResponse } from "next/server";
import { COST_TOPOLOGY, getCategorie, getSottoCategorie, getVoci } from "@/lib/cost-topology";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const macro = url.searchParams.get("macro");
  const categoria = url.searchParams.get("categoria");
  const sottocategoria = url.searchParams.get("sottocategoria");

  // Top level: macro areas
  if (!macro) {
    return NextResponse.json({
      macro_areas: COST_TOPOLOGY.map(m => ({ macro_area: m.macro_area, conto_gestionale: m.conto_gestionale })),
    });
  }

  // Second level: categorie
  if (!categoria) {
    return NextResponse.json({ categorie: getCategorie(macro) });
  }

  // Third level: sottocategorie
  if (!sottocategoria) {
    return NextResponse.json({ sottocategorie: getSottoCategorie(macro, categoria) });
  }

  // Fourth level: voci
  return NextResponse.json({ voci: getVoci(macro, categoria, sottocategoria) });
}