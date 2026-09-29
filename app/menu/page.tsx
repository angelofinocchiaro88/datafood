import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface DishAnalysis {
  id: string;
  name: string;
  cat: string;
  price: number;
  recipeCost: number;
  marginPct: number;
  salesQty: number;
  totalRev: number;
  totalMargin: number;
  quadrant: string;
  rec: string;
  color: string;
}

export default async function MenuEngineeringPage() {
  const dishes = await prisma.dish.findMany({
    include: {
      category: true,
      recipes: { include: { ingredient: true } },
      saleItems: true,
    },
  });

  // Calculate metrics per dish (only with recipes)
  const analysis: DishAnalysis[] = dishes
    .filter((d) => d.recipes.length > 0)
    .map((d) => {
      const rc = d.recipes.reduce((s, r) => s + r.ingredient.unitPrice * r.quantity, 0);
      const vat = d.category?.name === "Bevande" ? (d.name.includes("Vino") ? 22 : 10) : 10;
      const pex = d.price / (1 + vat / 100);
      const marginVal = pex - rc;
      const marginPct = pex > 0 ? (marginVal / pex) * 100 : 0;
      const qty = d.saleItems.reduce((s, si) => s + si.quantity, 0);
      const totalRev = Math.round(qty * d.price * 100) / 100;
      const totalMargin = Math.round(qty * marginVal * 100) / 100;

      return {
        id: d.id,
        name: d.name,
        cat: d.category?.name || "",
        price: d.price,
        recipeCost: Math.round(rc * 100) / 100,
        marginPct: Math.round(marginPct * 10) / 10,
        salesQty: Math.round(qty),
        totalRev,
        totalMargin,
        quadrant: "",
        rec: "",
        color: "",
      };
    });

  if (analysis.length === 0) {
    return <div className="p-8 text-center text-gray-500">Nessun dato disponibile.</div>;
  }

  // Calculate averages
  const avgMargin = analysis.reduce((s, d) => s + d.marginPct, 0) / analysis.length;
  const avgQty = analysis.reduce((s, d) => s + d.salesQty, 0) / analysis.length;

  // Assign quadrants
  const colors: Record<string, string> = {
    Star: "bg-green-50 border-green-300 text-green-800",
    Puzzle: "bg-blue-50 border-blue-300 text-blue-800",
    "Plow Horse": "bg-yellow-50 border-yellow-300 text-yellow-800",
    Dog: "bg-red-50 border-red-300 text-red-800",
  };

  const icons: Record<string, string> = { Star: "⭐", Puzzle: "🧩", "Plow Horse": "🐴", Dog: "❌" };
  const recs: Record<string, string> = {
    Star: "Mantieni e promuovi. Sono i tuoi piatti migliori: alta marginalità e alte vendite.",
    Puzzle: "Aumenta visibilità o rivedi il prezzo. Alta marginalità ma basse vendite: promuovili di più.",
    "Plow Horse": "Ottimizza costo ricetta o aumenta prezzo. Alte vendite ma bassa marginalità.",
    Dog: "Valuta eliminazione o riposizionamento. Se non strategici, rimuovi dal menu.",
  };

  const quadrants: Record<string, DishAnalysis[]> = { Star: [], Puzzle: [], "Plow Horse": [], Dog: [] };

  for (const d of analysis) {
    if (d.marginPct >= avgMargin && d.salesQty >= avgQty) d.quadrant = "Star";
    else if (d.marginPct >= avgMargin && d.salesQty < avgQty) d.quadrant = "Puzzle";
    else if (d.marginPct < avgMargin && d.salesQty >= avgQty) d.quadrant = "Plow Horse";
    else d.quadrant = "Dog";
    d.color = colors[d.quadrant];
    d.rec = recs[d.quadrant];
    quadrants[d.quadrant].push(d);
  }

  const quadrantOrder = ["Star", "Puzzle", "Plow Horse", "Dog"];
  const fmt = (n: number) => `€${n.toLocaleString("it-IT")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Menu Engineering</h1>
        <p className="text-gray-500 mt-1">
          Matrice di Kasavana & Smith · {analysis.length} piatti analizzati
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-xs text-gray-500">Margine Medio</p>
          <p className="text-xl font-bold text-gray-900">{avgMargin.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-xs text-gray-500">Vendite Medie</p>
          <p className="text-xl font-bold text-gray-900">{Math.round(avgQty)} pz</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-xs text-gray-500">Piatti</p>
          <p className="text-xl font-bold text-gray-900">{analysis.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-xs text-gray-500">Ricavo Totale</p>
          <p className="text-xl font-bold text-gray-900">{fmt(analysis.reduce((s, d) => s + d.totalRev, 0))}</p>
        </div>
      </div>

      {/* Quadrant grid */}
      <div className="grid grid-cols-2 gap-3">
        {quadrantOrder.map((q) => (
          <div key={q} className={`rounded-xl border-2 p-4 ${colors[q].split(" ")[0]} ${colors[q].split(" ")[1]}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{icons[q]}</span>
              <h3 className={`font-heading font-semibold text-lg ${colors[q].split(" ")[2]}`}>{q === "Plow Horse" ? "Plow Horse" : q}s</h3>
              <span className="text-xs opacity-60 ml-auto">{quadrants[q].length} piatti</span>
            </div>
            <p className="text-xs opacity-70 mb-3">{recs[q]}</p>
            <div className="space-y-1.5">
              {quadrants[q].map((d) => (
                <div key={d.id} className="bg-white rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.cat} · €{d.recipeCost.toFixed(2)} costo</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-bold text-sm">{d.marginPct}%</p>
                    <p className="text-xs text-gray-500">{d.salesQty} pz</p>
                  </div>
                </div>
              ))}
              {quadrants[q].length === 0 && <p className="text-xs opacity-50 italic py-2">Nessun piatto in questo quadrante</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Scatter chart approximation */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-4">Posizionamento Piatti</h3>
        <p className="text-xs text-gray-400 mb-4">
          Asse X = Vendite (pz) · Asse Y = Margine (%)
          <span className="ml-4">── Margine medio: {avgMargin.toFixed(1)}%</span>
          <span className="ml-4">── Vendite medie: {Math.round(avgQty)} pz</span>
        </p>
        <div className="relative border border-gray-200 rounded-lg bg-gray-50" style={{ height: "400px" }}>
          {/* Quadrant lines */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 border-r border-dashed border-gray-300 flex items-end justify-center pb-2">
              <span className="text-xs text-gray-400 bg-white px-1">Bassa Vendita</span>
            </div>
            <div className="flex-1 flex items-end justify-center pb-2">
              <span className="text-xs text-gray-400 bg-white px-1">Alta Vendita</span>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 border-b border-dashed border-gray-300 flex items-center px-2">
              <span className="text-xs text-gray-400 bg-white px-1">Alto Margine</span>
            </div>
            <div className="flex-1 flex items-center px-2">
              <span className="text-xs text-gray-400 bg-white px-1">Basso Margine</span>
            </div>
          </div>

          {/* Quadrant labels */}
          <div className="absolute top-2 right-2 text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded">⭐ Stars</div>
          <div className="absolute top-2 left-2 text-xs text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded">🧩 Puzzles</div>
          <div className="absolute bottom-2 right-2 text-xs text-yellow-700 font-medium bg-yellow-50 px-2 py-0.5 rounded">🐴 Plow Horses</div>
          <div className="absolute bottom-2 left-2 text-xs text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded">❌ Dogs</div>

          {/* Plot points */}
          {analysis.map((d) => {
            const maxQty = Math.max(...analysis.map((x) => x.salesQty), 1);
            // Position: x = sales % of max, y = margin % mapped to 0-100
            const left = `${((d.salesQty / maxQty) * 85) + 7.5}%`;
            const bottom = `${Math.max(2, Math.min(95, d.marginPct))}%`;
            return (
              <div
                key={d.id}
                className="absolute z-10 group cursor-pointer"
                style={{ left, bottom }}
              >
                <div
                  className="w-3 h-3 rounded-full shadow border"
                  style={{
                    backgroundColor: d.quadrant === "Star" ? "#22c55e" : d.quadrant === "Puzzle" ? "#3b82f6" : d.quadrant === "Plow Horse" ? "#eab308" : "#ef4444",
                    borderColor: d.quadrant === "Star" ? "#16a34a" : d.quadrant === "Puzzle" ? "#2563eb" : d.quadrant === "Plow Horse" ? "#ca8a04" : "#dc2626",
                  }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-white border shadow-lg rounded-lg p-2 text-xs whitespace-nowrap z-20">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-gray-500">{d.marginPct}% · {d.salesQty} pz · {d.cat}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold">Dettaglio Completo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Piatto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Cat</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Prezzo</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Costo</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Margine%</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Vendite</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Ricavo</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Quadrante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analysis.sort((a, b) => b.marginPct - a.marginPct).map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2 text-gray-500">{d.cat}</td>
                  <td className="px-3 py-2 text-right font-mono">€{d.price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">€{d.recipeCost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: d.marginPct > avgMargin ? "#16a34a" : "#dc2626" }}>{d.marginPct}%</td>
                  <td className="px-3 py-2 text-right">{d.salesQty}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(d.totalRev)}</td>
                  <td className="px-3 py-2">{icons[d.quadrant]} <span className="text-xs font-medium">{d.quadrant}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}