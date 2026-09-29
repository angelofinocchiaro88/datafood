export type RecipeCostLineInput = {
  quantity: number;
  unit?: string | null;
  wastePct?: number | null;
  ingredient?: { unit?: string | null; unitPrice?: number | null } | null;
};

export type RecipeCostInput = {
  yieldPortions?: number | null;
  recipes?: RecipeCostLineInput[] | null;
};

export type RecipeCostLine = {
  quantity: number;
  recipeUnit: string;
  ingredientUnit: string;
  quantityInPurchaseUnit: number | null;
  purchaseQuantityWithWaste: number | null;
  unitPrice: number;
  wastePct: number;
  lineCost: number | null;
  complete: boolean;
  issue: string | null;
};

export type RecipeCostResult = {
  totalBatchCost: number;
  yieldPortions: number;
  costPerPortion: number | null;
  complete: boolean;
  lines: RecipeCostLine[];
};

type UnitDefinition = { family: string; factor: number; canonical: string };

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  mg: { family: "mass", factor: 0.001, canonical: "mg" },
  g: { family: "mass", factor: 1, canonical: "g" },
  gr: { family: "mass", factor: 1, canonical: "g" },
  grammo: { family: "mass", factor: 1, canonical: "g" },
  grammi: { family: "mass", factor: 1, canonical: "g" },
  hg: { family: "mass", factor: 100, canonical: "hg" },
  etto: { family: "mass", factor: 100, canonical: "hg" },
  etti: { family: "mass", factor: 100, canonical: "hg" },
  kg: { family: "mass", factor: 1000, canonical: "kg" },
  kilo: { family: "mass", factor: 1000, canonical: "kg" },
  chili: { family: "mass", factor: 1000, canonical: "kg" },
  ml: { family: "volume", factor: 1, canonical: "ml" },
  cl: { family: "volume", factor: 10, canonical: "cl" },
  dl: { family: "volume", factor: 100, canonical: "dl" },
  l: { family: "volume", factor: 1000, canonical: "l" },
  lt: { family: "volume", factor: 1000, canonical: "l" },
  litro: { family: "volume", factor: 1000, canonical: "l" },
  litri: { family: "volume", factor: 1000, canonical: "l" },
  pz: { family: "count", factor: 1, canonical: "pz" },
  pz_: { family: "count", factor: 1, canonical: "pz" },
  pezzo: { family: "count", factor: 1, canonical: "pz" },
  pezzi: { family: "count", factor: 1, canonical: "pz" },
  unit: { family: "count", factor: 1, canonical: "pz" },
  units: { family: "count", factor: 1, canonical: "pz" },
  pc: { family: "count", factor: 1, canonical: "pz" },
  pcs: { family: "count", factor: 1, canonical: "pz" },
  piece: { family: "count", factor: 1, canonical: "pz" },
  pieces: { family: "count", factor: 1, canonical: "pz" },
  unita: { family: "count", factor: 1, canonical: "pz" },
  unita_: { family: "count", factor: 1, canonical: "pz" },
};

function normalizeUnit(unit?: string | null) {
  return (unit || "pz")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.]/g, "_")
    .replace(/\s+/g, "_");
}

export function getUnitFamily(unit?: string | null) {
  const key = normalizeUnit(unit);
  return UNIT_DEFINITIONS[key]?.family || `custom:${key}`;
}

export function getCompatibleRecipeUnits(ingredientUnit?: string | null) {
  const key = normalizeUnit(ingredientUnit);
  const family = getUnitFamily(key);
  if (family === "mass") return ["g", "kg", "mg"];
  if (family === "volume") return ["ml", "cl", "l"];
  if (family === "count") return ["pz"];
  return [ingredientUnit?.trim() || key];
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  const fromKey = normalizeUnit(fromUnit);
  const toKey = normalizeUnit(toUnit);
  const from = UNIT_DEFINITIONS[fromKey];
  const to = UNIT_DEFINITIONS[toKey];

  if (from && to && from.family === to.family) return quantity * from.factor / to.factor;
  if (!from && !to && fromKey === toKey) return quantity;
  return null;
}

export function calculateRecipeCost(dish: RecipeCostInput): RecipeCostResult {
  const recipes = dish.recipes || [];
  const yieldPortions = Number(dish.yieldPortions ?? 1);
  let totalBatchCost = 0;
  let complete = recipes.length > 0 && Number.isFinite(yieldPortions) && yieldPortions > 0;

  const lines = recipes.map(recipe => {
    const ingredientUnit = recipe.ingredient?.unit?.trim() || "pz";
    const recipeUnit = recipe.unit?.trim() || ingredientUnit;
    const unitPrice = Number(recipe.ingredient?.unitPrice ?? 0);
    const quantity = Number(recipe.quantity);
    const wastePct = Number(recipe.wastePct ?? 0);
    const quantityInPurchaseUnit = convertQuantity(quantity, recipeUnit, ingredientUnit);

    let issue: string | null = null;
    if (!Number.isFinite(quantity) || quantity <= 0) issue = "Quantità non valida";
    else if (quantityInPurchaseUnit == null) issue = `Unità incompatibili: ${recipeUnit} e ${ingredientUnit}`;
    else if (!Number.isFinite(wastePct) || wastePct < 0 || wastePct >= 100) issue = "Scarto deve essere tra 0% e 99,9%";
    else if (!Number.isFinite(unitPrice) || unitPrice <= 0) issue = "Prezzo ingrediente mancante";

    const purchaseQuantityWithWaste = issue == null && quantityInPurchaseUnit != null
      ? quantityInPurchaseUnit / (1 - wastePct / 100)
      : null;
    const lineCost = purchaseQuantityWithWaste == null ? null : purchaseQuantityWithWaste * unitPrice;
    if (lineCost == null || !Number.isFinite(lineCost)) complete = false;
    else totalBatchCost += lineCost;

    return {
      quantity,
      recipeUnit,
      ingredientUnit,
      quantityInPurchaseUnit,
      purchaseQuantityWithWaste,
      unitPrice,
      wastePct,
      lineCost,
      complete: issue == null && lineCost != null,
      issue,
    };
  });

  return {
    totalBatchCost,
    yieldPortions,
    costPerPortion: complete ? totalBatchCost / yieldPortions : null,
    complete,
    lines,
  };
}

export function getNetSellingPrice(grossPrice: number, vatRate: number) {
  if (!Number.isFinite(grossPrice) || grossPrice <= 0 || !Number.isFinite(vatRate) || vatRate < 0) return null;
  return grossPrice / (1 + vatRate / 100);
}

export function getFoodCostPct(costPerPortion: number | null, grossPrice: number, vatRate: number) {
  const netPrice = getNetSellingPrice(grossPrice, vatRate);
  if (costPerPortion == null || netPrice == null || netPrice <= 0) return null;
  return costPerPortion / netPrice * 100;
}

export function getContributionMargin(costPerPortion: number | null, grossPrice: number, vatRate: number) {
  const netPrice = getNetSellingPrice(grossPrice, vatRate);
  if (costPerPortion == null || netPrice == null) return null;
  return netPrice - costPerPortion;
}

export function getGrossTargetPrice(costPerPortion: number | null, foodCostTargetPct: number, vatRate: number) {
  if (costPerPortion == null || !Number.isFinite(foodCostTargetPct) || foodCostTargetPct <= 0 || !Number.isFinite(vatRate) || vatRate < 0) return null;
  return costPerPortion / (foodCostTargetPct / 100) * (1 + vatRate / 100);
}
