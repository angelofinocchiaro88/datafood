"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleDollarSign, ClipboardList, CookingPot, FilePlus2, Info, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  calculateRecipeCost,
  getCompatibleRecipeUnits,
  getContributionMargin,
  getFoodCostPct,
  getGrossTargetPrice,
  getNetSellingPrice,
} from "@/lib/recipe-cost";

type Ingredient = { id: string; name: string; unit: string; unitPrice: number; currentStock: number; categoria: string };
type RecipeLine = { id: string; dishId: string; ingredientId: string; quantity: number; unit: string | null; wastePct: number; ingredient: Ingredient };
type Dish = {
  id: string;
  name: string;
  price: number;
  vatRate: number;
  yieldPortions: number;
  description: string | null;
  preparation: string | null;
  categoryId: string;
  category: { id: string; name: string };
  recipes: RecipeLine[];
};
type Category = { id: string; name: string };

const VAT_RATES = [4, 5, 10, 22];

function euro(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "N/D";
  return `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function FoodCostWorkspace() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recipeFilter, setRecipeFilter] = useState("all");
  const [targetFoodCost, setTargetFoodCost] = useState(30);
  const [showDishForm, setShowDishForm] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [dishForm, setDishForm] = useState({ name: "", categoryId: "", price: "", vatRate: "10", yieldPortions: "1", description: "", preparation: "" });
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState({ ingredientId: "", quantity: "", unit: "", wastePct: "0" });
  const [showQuickIngredient, setShowQuickIngredient] = useState(false);
  const [quickIngredient, setQuickIngredient] = useState({ name: "", unit: "kg", unitPrice: "", categoria: "Altro" });

  const load = async (preferredId?: string) => {
    setLoading(true);
    try {
      const [dishResponse, ingredientResponse, categoryResponse] = await Promise.all([
        fetch("/api/dishes"), fetch("/api/ingredients"), fetch("/api/categories"),
      ]);
      if (!dishResponse.ok || !ingredientResponse.ok || !categoryResponse.ok) throw new Error("Impossibile caricare piatti, ingredienti o categorie.");
      const [dishData, ingredientData, categoryData] = await Promise.all([dishResponse.json(), ingredientResponse.json(), categoryResponse.json()]);
      const dishRows = Array.isArray(dishData) ? dishData : [];
      setDishes(dishRows);
      setIngredients(Array.isArray(ingredientData) ? ingredientData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSelectedId(current => {
        const wanted = preferredId || current;
        return dishRows.some((dish: Dish) => dish.id === wanted) ? wanted : dishRows[0]?.id || null;
      });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Errore di caricamento", error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectedDish = dishes.find(dish => dish.id === selectedId) || null;
  const costing = selectedDish ? calculateRecipeCost(selectedDish) : null;
  const foodCostPct = selectedDish && costing ? getFoodCostPct(costing.costPerPortion, selectedDish.price, selectedDish.vatRate) : null;
  const netPrice = selectedDish ? getNetSellingPrice(selectedDish.price, selectedDish.vatRate) : null;
  const marginPerPortion = selectedDish && costing ? getContributionMargin(costing.costPerPortion, selectedDish.price, selectedDish.vatRate) : null;
  const targetPrice = costing ? getGrossTargetPrice(costing.costPerPortion, targetFoodCost, selectedDish?.vatRate || 10) : null;

  const dishState = (dish: Dish) => {
    const cost = calculateRecipeCost(dish);
    return dish.recipes.length === 0 ? "empty" : cost.complete ? "complete" : "incomplete";
  };
  const completeCount = dishes.filter(dish => dishState(dish) === "complete").length;
  const incompleteCount = dishes.length - completeCount;
  const ingredientWarnings = ingredients.filter(ingredient => ingredient.unitPrice <= 0).length;

  const visibleDishes = useMemo(() => dishes.filter(dish => {
    const matchesSearch = !search || dish.name.toLocaleLowerCase("it-IT").includes(search.toLocaleLowerCase("it-IT"));
    const matchesCategory = categoryFilter === "all" || dish.categoryId === categoryFilter;
    const status = dish.recipes.length === 0 ? "empty" : calculateRecipeCost(dish).complete ? "complete" : "incomplete";
    const matchesRecipe = recipeFilter === "all" || status === recipeFilter;
    return matchesSearch && matchesCategory && matchesRecipe;
  }), [dishes, search, categoryFilter, recipeFilter]);

  const openCreateDish = () => {
    setEditingDish(null);
    setDishForm({ name: "", categoryId: categories[0]?.id || "", price: "", vatRate: "10", yieldPortions: "1", description: "", preparation: "" });
    setShowDishForm(true);
  };

  const openEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setDishForm({ name: dish.name, categoryId: dish.categoryId, price: String(dish.price), vatRate: String(dish.vatRate), yieldPortions: String(dish.yieldPortions), description: dish.description || "", preparation: dish.preparation || "" });
    setShowDishForm(true);
  };

  const saveDish = async () => {
    if (!dishForm.name.trim() || !dishForm.categoryId || Number(dishForm.price) <= 0) {
      setMessage({ text: "Inserisci nome, categoria e prezzo di listino maggiore di zero.", error: true });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editingDish ? `/api/dishes/${editingDish.id}` : "/api/dishes", {
        method: editingDish ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dishForm, price: Number(dishForm.price), vatRate: Number(dishForm.vatRate), yieldPortions: Number(dishForm.yieldPortions) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Salvataggio scheda non riuscito");
      setShowDishForm(false);
      setMessage({ text: editingDish ? "Scheda aggiornata." : "Piatto creato: ora completa ingredienti e quantità della ricetta." });
      await load(result.id);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Errore di salvataggio", error: true });
    } finally {
      setSaving(false);
    }
  };

  const beginAddLine = () => {
    setEditingLineId(null);
    setLineForm({ ingredientId: "", quantity: "", unit: "", wastePct: "0" });
    setShowRecipeForm(true);
  };

  const beginEditLine = (line: RecipeLine) => {
    setEditingLineId(line.id);
    setLineForm({ ingredientId: line.ingredientId, quantity: String(line.quantity), unit: line.unit || line.ingredient.unit, wastePct: String(line.wastePct || 0) });
    setShowRecipeForm(true);
  };

  const saveRecipeLine = async () => {
    if (!selectedDish || !lineForm.ingredientId || Number(lineForm.quantity) <= 0) {
      setMessage({ text: "Seleziona un ingrediente e inserisci una quantità positiva.", error: true });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishId: selectedDish.id, ingredientId: lineForm.ingredientId, quantity: Number(lineForm.quantity), unit: lineForm.unit, wastePct: Number(lineForm.wastePct) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossibile salvare la riga ricetta");
      setShowRecipeForm(false);
      setMessage({ text: editingLineId ? "Quantità ricetta aggiornata." : "Ingrediente aggiunto alla ricetta." });
      await load(selectedDish.id);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Errore di salvataggio", error: true });
    } finally {
      setSaving(false);
    }
  };

  const removeRecipeLine = async (line: RecipeLine) => {
    if (!selectedDish || !confirm(`Rimuovere ${line.ingredient.name} dalla ricetta di ${selectedDish.name}?`)) return;
    const response = await fetch("/api/recipes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId: selectedDish.id, ingredientId: line.ingredientId }) });
    if (!response.ok) { setMessage({ text: "Non è stato possibile rimuovere l’ingrediente.", error: true }); return; }
    setMessage({ text: `${line.ingredient.name} rimosso dalla scheda.` });
    await load(selectedDish.id);
  };

  const createQuickIngredient = async () => {
    if (!quickIngredient.name.trim() || Number(quickIngredient.unitPrice) <= 0) {
      setMessage({ text: "Inserisci il nome e il costo di acquisto per unità dell’ingrediente.", error: true });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quickIngredient, unitPrice: Number(quickIngredient.unitPrice), currentStock: 0, minStock: 0 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Creazione ingrediente non riuscita");
      setLineForm({ ingredientId: result.id, quantity: "", unit: result.unit, wastePct: "0" });
      setShowQuickIngredient(false);
      setShowRecipeForm(true);
      setMessage({ text: "Ingrediente creato nel Magazzino. Inserisci ora quantità e scarto nella ricetta." });
      await load(selectedDish?.id);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Errore di salvataggio", error: true });
    } finally {
      setSaving(false);
    }
  };

  const selectedIngredient = ingredients.find(ingredient => ingredient.id === lineForm.ingredientId);
  const recipeUnits = selectedIngredient
    ? Array.from(new Set([selectedIngredient.unit, ...getCompatibleRecipeUnits(selectedIngredient.unit)]))
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">DATAFOOD · Schede tecniche</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Food Cost</h1>
          <p className="mt-1 text-sm text-slate-500">Ingredienti → ricetta standard → costo per porzione → prezzo e margine</p>
        </div>
        <div className="flex gap-2">
          <Link href="/magazzino" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400"><Package className="h-4 w-4" /> Costi ingredienti</Link>
          <button onClick={openCreateDish} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><FilePlus2 className="h-4 w-4" /> Nuova scheda</button>
        </div>
      </header>

      {message && <div className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${message.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span>{message.text}</span><button onClick={() => setMessage(null)} aria-label="Chiudi avviso"><X className="h-4 w-4" /></button></div>}

      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Scheda teorica:</strong> il costo usa i prezzi unitari correnti del Magazzino, le quantità, lo scarto e la resa batch. Non è il consumo consuntivo da inventario. Aggiornando il costo di acquisto dell’ingrediente si aggiornano tutte le ricette collegate.</p></div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Schede piatto" value={String(dishes.length)} detail="ricette nel menù" icon={<ClipboardList className="h-4 w-4" />} />
        <Summary label="Complete e calcolabili" value={String(completeCount)} detail="unità e costi validi" icon={<Check className="h-4 w-4" />} />
        <Summary label="Da completare" value={String(incompleteCount)} detail="ricetta, quantità o costo mancante" icon={<AlertTriangle className="h-4 w-4" />} warning={incompleteCount > 0} />
        <Summary label="Ingredienti senza costo" value={String(ingredientWarnings)} detail="richiedono costo acquisto" icon={<CircleDollarSign className="h-4 w-4" />} warning={ingredientWarnings > 0} />
      </section>

      <div className="grid min-h-[620px] grid-cols-1 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca una ricetta…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
              <option value="all">Tutte le categorie</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={recipeFilter} onChange={event => setRecipeFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
              <option value="all">Tutti gli stati</option><option value="complete">Calcolabili</option><option value="incomplete">Incomplete</option><option value="empty">Senza ricetta</option>
            </select>
          </div>
          <div className="flex items-center justify-between px-1 text-xs text-slate-400"><span>Ricette</span><span>{visibleDishes.length} / {dishes.length}</span></div>
          <div className="max-h-[660px] space-y-1 overflow-y-auto">
            {visibleDishes.map(dish => {
              const cost = calculateRecipeCost(dish);
              const fc = getFoodCostPct(cost.costPerPortion, dish.price, dish.vatRate);
              const status = dish.recipes.length === 0 ? "empty" : cost.complete ? "complete" : "incomplete";
              return (
                <button key={dish.id} onClick={() => { setSelectedId(dish.id); setShowRecipeForm(false); setMessage(null); }} className={`w-full rounded-lg border p-3 text-left transition ${selectedId === dish.id ? "border-emerald-400 bg-emerald-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-800">{dish.name}</span><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === "complete" ? "bg-emerald-500" : status === "empty" ? "bg-slate-300" : "bg-amber-500"}`} /></div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500"><span className="truncate">{dish.category.name} · {dish.recipes.length} ingredienti</span><span className="font-semibold text-slate-700">{fc == null ? "FC N/D" : `FC ${fc.toFixed(1)}%`}</span></div>
                </button>
              );
            })}
            {!loading && visibleDishes.length === 0 && <div className="p-6 text-center text-sm text-slate-400">Nessuna scheda trovata.</div>}
            {loading && <div className="p-6 text-center text-sm text-slate-400">Caricamento schede…</div>}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {!selectedDish ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <CookingPot className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 text-lg font-semibold text-slate-900">Crea la prima scheda tecnica</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">Definisci prezzo, aliquota e resa della ricetta; poi aggiungi ingredienti, quantità nette e scarti.</p>
              <button onClick={openCreateDish} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Crea piatto</button>
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs text-slate-500">{selectedDish.category.name} · IVA {selectedDish.vatRate}% · resa batch {selectedDish.yieldPortions} porzioni</p><h2 className="mt-1 text-xl font-bold text-slate-900">{selectedDish.name}</h2>{selectedDish.description && <p className="mt-1 text-sm text-slate-500">{selectedDish.description}</p>}</div>
                  <div className="flex gap-1"><button onClick={() => openEditDish(selectedDish)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-emerald-700" title="Modifica dati piatto"><Pencil className="h-4 w-4" /></button><button onClick={async () => { if (confirm(`Eliminare la scheda ${selectedDish.name} e la sua ricetta?`)) { const response = await fetch(`/api/dishes/${selectedDish.id}`, { method: "DELETE" }); if (response.ok) { setMessage({ text: "Scheda eliminata." }); await load(); } else setMessage({ text: "Eliminazione non riuscita.", error: true }); } }} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-rose-600" title="Elimina scheda"><Trash2 className="h-4 w-4" /></button></div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
                  <CostMetric label="Costo batch" value={euro(costing?.totalBatchCost)} detail={costing?.complete ? "ingredienti + scarto" : "parziale: controlla righe"} />
                  <CostMetric label="Costo / porzione" value={euro(costing?.costPerPortion)} detail={`resa ${selectedDish.yieldPortions} porzioni`} strong />
                  <CostMetric label="Prezzo netto IVA" value={euro(netPrice)} detail={`listino lordo ${euro(selectedDish.price)}`} />
                  <CostMetric label="Food Cost" value={foodCostPct == null ? "N/D" : `${foodCostPct.toFixed(1)}%`} detail={`obiettivo ${targetFoodCost}%`} warning={foodCostPct != null && foodCostPct > targetFoodCost} />
                  <CostMetric label="Margine contribuzione" value={euro(marginPerPortion)} detail="prezzo netto − costo porzione" strong />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <label className="flex items-center gap-2">Food Cost obiettivo
                    <input type="number" min="10" max="80" step="1" value={targetFoodCost} onChange={event => setTargetFoodCost(Math.min(80, Math.max(10, Number(event.target.value) || 30)))} className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right" />%
                  </label>
                  <span>Prezzo minimo teorico a target: <strong className="text-slate-900">{euro(targetPrice)}</strong></span>
                  <span className="text-slate-400">Solo simulazione; non cambia il listino.</span>
                </div>
              </section>

              {costing && !costing.complete && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Costo ricetta non completo.</strong> Correggi le righe segnalate; Food Cost e margine resteranno N/D finché quantità, unità, costo ingrediente e resa non sono validi.</div></div>
              )}

              {selectedDish.preparation && <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-semibold text-slate-800">Procedimento standard</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{selectedDish.preparation}</p></section>}

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                  <div><h3 className="font-semibold text-slate-900">Scheda ingredienti</h3><p className="text-xs text-slate-500">Quantità netta per batch; il costo acquisto viene convertito nella stessa unità e corretto per lo scarto.</p></div>
                  <div className="flex gap-2"><Link href="/magazzino" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-emerald-400"><Package className="h-3.5 w-3.5" /> Catalogo ingredienti</Link><button onClick={beginAddLine} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Aggiungi ingrediente</button></div>
                </div>

                {showRecipeForm && (
                  <div className="border-b border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold text-slate-900">{editingLineId ? "Modifica ingrediente" : "Aggiungi alla ricetta"}</h4><p className="text-xs text-slate-500">Il costo unitario è quello impostato nel catalogo ingredienti.</p></div><button onClick={() => setShowRecipeForm(false)} aria-label="Chiudi"><X className="h-4 w-4 text-slate-500" /></button></div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1.5fr)_1fr_120px_120px_auto]">
                      <select value={lineForm.ingredientId} disabled={!!editingLineId} onChange={event => { const ingredient = ingredients.find(item => item.id === event.target.value); setLineForm({ ...lineForm, ingredientId: event.target.value, unit: ingredient?.unit || "" }); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="">Seleziona ingrediente</option>
                        {ingredients.filter(ingredient => editingLineId ? ingredient.id === lineForm.ingredientId : !selectedDish.recipes.some(line => line.ingredientId === ingredient.id)).map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} · {euro(ingredient.unitPrice)}/{ingredient.unit}</option>)}
                      </select>
                      <div className="flex gap-1"><input type="number" min="0.001" step="0.001" value={lineForm.quantity} onChange={event => setLineForm({ ...lineForm, quantity: event.target.value })} placeholder="Quantità netta" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"/><select value={lineForm.unit} onChange={event => setLineForm({ ...lineForm, unit: event.target.value })} className="w-20 rounded-lg border border-slate-300 bg-white px-2 text-sm">{recipeUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
                      <label className="relative"><input type="number" min="0" max="99.9" step="0.1" value={lineForm.wastePct} onChange={event => setLineForm({ ...lineForm, wastePct: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-7 text-sm"/><span className="absolute right-3 top-2.5 text-xs text-slate-400">% scarto</span></label>
                      <button disabled={saving} onClick={saveRecipeLine} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvo…" : "Salva riga"}</button>
                      <button onClick={() => setShowQuickIngredient(true)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:border-emerald-400">Nuovo ingrediente</button>
                    </div>
                    {selectedIngredient && <p className="mt-2 text-xs text-slate-500">Prezzo acquisto {euro(selectedIngredient.unitPrice)} / {selectedIngredient.unit} · giacenza {selectedIngredient.currentStock} {selectedIngredient.unit}</p>}
                  </div>
                )}

                {selectedDish.recipes.length === 0 ? (
                  <div className="p-8 text-center"><CookingPot className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-2 text-sm font-medium text-slate-700">La ricetta è ancora vuota</p><p className="mt-1 text-xs text-slate-500">Aggiungi ogni ingrediente con quantità netta e scarto previsto.</p><button onClick={beginAddLine} className="mt-3 text-sm font-semibold text-emerald-700">Aggiungi il primo ingrediente</button></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">Ingrediente</th><th className="px-3 py-2 text-right">Netto ricetta</th><th className="px-3 py-2 text-right">Scarto</th><th className="px-3 py-2 text-right">Acquisto equivalente</th><th className="px-3 py-2 text-right">Costo acquisto</th><th className="px-3 py-2 text-right">Costo batch</th><th className="px-3 py-2 text-right">Azioni</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedDish.recipes.map((line, index) => {
                          const calculated = costing?.lines[index];
                          return <tr key={line.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3"><p className="font-medium text-slate-800">{line.ingredient.name}</p>{calculated?.issue && <p className="mt-0.5 text-xs text-rose-600">{calculated.issue}</p>}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{line.quantity} {line.unit || line.ingredient.unit}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{line.wastePct || 0}%</td>
                            <td className="px-3 py-3 text-right tabular-nums">{calculated?.purchaseQuantityWithWaste == null ? "N/D" : `${calculated.purchaseQuantityWithWaste.toLocaleString("it-IT", { maximumFractionDigits: 4 })} ${line.ingredient.unit}`}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{euro(line.ingredient.unitPrice)} / {line.ingredient.unit}</td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">{euro(calculated?.lineCost)}</td>
                            <td className="px-3 py-3"><div className="flex justify-end gap-1"><button onClick={() => beginEditLine(line)} aria-label={`Modifica ${line.ingredient.name}`} className="rounded p-1.5 text-slate-400 hover:text-emerald-700"><Pencil className="h-4 w-4" /></button><button onClick={() => void removeRecipeLine(line)} aria-label={`Rimuovi ${line.ingredient.name}`} className="rounded p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></td>
                          </tr>;
                        })}
                      </tbody>
                      <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">Costo totale batch · {costing?.yieldPortions} porzioni</td><td className="px-3 py-3 text-right font-bold text-slate-900">{euro(costing?.totalBatchCost)}</td><td /></tr></tfoot>
                    </table>
                  </div>
                )}
              </section>

              {selectedDish.preparation && <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><Info className="mr-1 inline h-3.5 w-3.5"/>Il procedimento standard è salvato nella scheda del piatto.</div>}
            </>
          )}
        </main>
      </div>

      {showDishForm && <Modal title={editingDish ? "Modifica scheda ricetta" : "Crea scheda ricetta"} onClose={() => setShowDishForm(false)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Nome piatto *"><input autoFocus value={dishForm.name} onChange={event => setDishForm({ ...dishForm, name: event.target.value })} className="input" placeholder="Es. Tagliatelle al ragù"/></Field>
          <Field label="Categoria *"><select value={dishForm.categoryId} onChange={event => setDishForm({ ...dishForm, categoryId: event.target.value })} className="input"><option value="">Scegli categoria</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
          <Field label="Prezzo di listino lordo (€) *"><input type="number" min="0.01" step="0.01" value={dishForm.price} onChange={event => setDishForm({ ...dishForm, price: event.target.value })} className="input" placeholder="12,00"/></Field>
          <Field label="Aliquota IVA del piatto"><select value={dishForm.vatRate} onChange={event => setDishForm({ ...dishForm, vatRate: event.target.value })} className="input">{VAT_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></Field>
          <Field label="La ricetta produce quante porzioni? *"><input type="number" min="0.01" step="0.1" value={dishForm.yieldPortions} onChange={event => setDishForm({ ...dishForm, yieldPortions: event.target.value })} className="input"/><span className="mt-1 block text-[11px] text-slate-400">Esempio: una salsa preparata in batch da 10 porzioni.</span></Field>
          <Field label="Descrizione breve"><input value={dishForm.description} onChange={event => setDishForm({ ...dishForm, description: event.target.value })} className="input" placeholder="Opzionale"/></Field>
          <Field label="Procedimento standard" className="md:col-span-2"><textarea rows={4} value={dishForm.preparation} onChange={event => setDishForm({ ...dishForm, preparation: event.target.value })} className="input resize-y" placeholder="Passaggi, grammature, standard di impiattamento…"/></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowDishForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Annulla</button><button disabled={saving} onClick={saveDish} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvo…" : editingDish ? "Salva scheda" : "Crea scheda"}</button></div>
      </Modal>}

      {showQuickIngredient && <Modal title="Aggiungi ingrediente al catalogo" onClose={() => setShowQuickIngredient(false)}>
        <p className="mb-3 text-sm text-slate-500">Dopo il salvataggio verrà selezionato nella ricetta. Costo e unità sono quelli di acquisto nel Magazzino.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome ingrediente"><input value={quickIngredient.name} onChange={event => setQuickIngredient({ ...quickIngredient, name: event.target.value })} className="input" placeholder="Es. Farina 00"/></Field>
          <Field label="Unità acquisto"><select value={quickIngredient.unit} onChange={event => setQuickIngredient({ ...quickIngredient, unit: event.target.value })} className="input"><option value="kg">kg</option><option value="lt">lt</option><option value="pz">pz</option></select></Field>
          <Field label={`Costo per ${quickIngredient.unit} (€)`}><input type="number" min="0.001" step="0.001" value={quickIngredient.unitPrice} onChange={event => setQuickIngredient({ ...quickIngredient, unitPrice: event.target.value })} className="input" placeholder="0,00"/></Field>
          <Field label="Categoria"><select value={quickIngredient.categoria} onChange={event => setQuickIngredient({ ...quickIngredient, categoria: event.target.value })} className="input">{["Carni", "Pesce", "Verdure", "Latticini", "Pasta e cereali", "Condimenti", "Bevande", "Bakery", "Altro"].map(category => <option key={category}>{category}</option>)}</select></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowQuickIngredient(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Annulla</button><button disabled={saving} onClick={createQuickIngredient} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Crea ingrediente</button></div>
      </Modal>}
    </div>
  );
}

function Summary({ label, value, detail, icon, warning }: { label: string; value: string; detail: string; icon: ReactNode; warning?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="mb-1.5 flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${warning ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{icon}</span><span className="text-xs text-slate-500">{label}</span></div><p className="text-xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{detail}</p></div>;
}

function CostMetric({ label, value, detail, warning, strong }: { label: string; value: string; detail: string; warning?: boolean; strong?: boolean }) {
  return <div className={`rounded-lg border p-3 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-lg font-bold ${warning ? "text-amber-800" : strong ? "text-slate-900" : "text-slate-700"}`}>{value}</p><p className="mt-0.5 text-[10px] text-slate-400">{detail}</p></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button onClick={onClose} aria-label="Chiudi"><X className="h-5 w-5 text-slate-500" /></button></div>{children}</div></div>;
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block text-xs font-medium text-slate-600 ${className}`}>{label}{children}</label>;
}
