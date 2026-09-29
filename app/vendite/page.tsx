import { prisma } from "@/lib/db";
import Link from "next/link";
import { SalesView } from "./SalesView";

export const dynamic = "force-dynamic";

export default async function VenditePage() {
  const dishes = await prisma.dish.findMany({
    include: { category: true, saleItems: { include: { sale: true } } },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const year = now.getFullYear();

  const monthlyData = [0, 1, 2].map((m) => {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0);
    const monthSales = dishes.map((d) => {
      const items = d.saleItems.filter((si) => {
        const d2 = new Date(si.sale.date);
        return d2 >= monthStart && d2 <= monthEnd;
      });
      const qty = Math.round(items.reduce((s, i) => s + i.quantity, 0));
      const rev = items.reduce((s, i) => s + i.totalPrice, 0);
      return { dish: d.name, cat: d.category?.name || "", qty, rev };
    });
    return { month: m + 1, sales: monthSales };
  });

  const analysis = dishes.map((d) => {
    const totalQty = d.saleItems.reduce((s, i) => s + i.quantity, 0);
    const totalRev = d.saleItems.reduce((s, i) => s + i.totalPrice, 0);
    const recipeCost = 0;
    return { name: d.name, cat: d.category?.name || "", price: d.price, qty: Math.round(totalQty), rev: Math.round(totalRev * 100) / 100 };
  });

  const totalRev = analysis.reduce((s, d) => s + d.rev, 0);
  const totalQty = analysis.reduce((s, d) => s + d.qty, 0);
  const avgTicket = totalRev / (dishes[0]?.saleItems.length || 1);

  const topDishes = [...analysis].sort((a, b) => b.qty - a.qty).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Vendite</h1>
        <p className="text-gray-500 mt-1">Analisi vendite Q1 2026</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Ricavi Q1" value={`€${totalRev.toLocaleString("it-IT", { minimumFractionDigits: 0 })}`} color="blue" />
        <Stat label="Piatti Venduti" value={totalQty.toLocaleString()} color="green" />
        <Stat label="Ticket Medio" value={`€${(totalRev / (totalQty || 1)).toFixed(2)}`} color="amber" />
        <Stat label="Giorni" value="90" subtitle="Gennaio - Marzo 2026" color="default" />
      </div>

      <SalesView monthlyData={monthlyData} analysis={analysis} topDishes={topDishes} totalRev={totalRev} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold">Dettaglio Vendite per Piatto</h2>
          <Link href="/food-cost" className="text-xs text-primary hover:underline">Vedi Food Cost →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Piatto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Categoria</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Prezzo</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Gen</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Feb</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Mar</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Totale Q1</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Ricavo Q1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analysis.sort((a, b) => b.rev - a.rev).map((d) => {
                const gen = monthlyData[0].sales.find((s) => s.dish === d.name);
                const feb = monthlyData[1].sales.find((s) => s.dish === d.name);
                const mar = monthlyData[2].sales.find((s) => s.dish === d.name);
                return (
                  <tr key={d.name} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{d.name}</td>
                    <td className="px-3 py-2 text-gray-500">{d.cat}</td>
                    <td className="px-3 py-2 text-right font-mono">€{d.price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{gen?.qty || 0}</td>
                    <td className="px-3 py-2 text-right">{feb?.qty || 0}</td>
                    <td className="px-3 py-2 text-right">{mar?.qty || 0}</td>
                    <td className="px-3 py-2 text-right font-medium">{d.qty}</td>
                    <td className="px-3 py-2 text-right font-mono">€{d.rev.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, subtitle, color }: { label: string; value: string; subtitle?: string; color: string }) {
  const colors: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", green: "bg-green-50 border-green-200 text-green-700", amber: "bg-amber-50 border-amber-200 text-amber-700", red: "bg-red-50 border-red-200 text-red-700", default: "bg-white border-gray-200 text-gray-900" };
  return (
    <div className={`${colors[color]} rounded-xl p-4 border`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
    </div>
  );
}