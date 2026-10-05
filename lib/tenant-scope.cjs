const CLIENT_SCOPED_MODELS = new Set([
  "Category", "Dish", "Ingredient", "Supplier", "Sale", "Invoice", "PosConfig", "EmailConfig", "EmailLog", "SdiConfig",
  "ChatSession", "FiscalYear", "BudgetTarget", "Asset", "FatturaEmessa", "Account", "CashFlowCategory", "CashTransaction",
  "CashFlowForecast", "ForecastRule", "PaymentSchedule", "Alert", "Dipendente", "Contratto", "BustaPaga", "Recipe", "Order", "OrderItem", "Movement", "SaleItem", "InvoiceItem", "YearlySummary", "ChatMessage",
]);

const RELATED_CLIENT_SCOPES = {};

function applyClientToWhere(model, where = {}, clientId) {
  if (model === "BudgetTarget" && where.year_month_clientId) {
    return { ...where, year_month_clientId: { ...where.year_month_clientId, clientId } };
  }
  if (model === "FiscalYear" && where.year_clientId) {
    return { ...where, year_clientId: { ...where.year_clientId, clientId } };
  }
  if (CLIENT_SCOPED_MODELS.has(model)) return { ...where, clientId };
  const relationScope = RELATED_CLIENT_SCOPES[model];
  if (!relationScope) return where;
  const relation = Object.keys(relationScope)[0];
  const nested = structuredClone(relationScope[relation]);
  const setLeaf = value => {
    if (Object.prototype.hasOwnProperty.call(value, "clientId")) { value.clientId = clientId; return; }
    const child = Object.keys(value)[0];
    if (child) setLeaf(value[child]);
  };
  setLeaf(nested);
  return { ...where, [relation]: { ...(where[relation] || {}), ...nested } };
}

function applyClientToData(model, data, clientId) {
  if (!CLIENT_SCOPED_MODELS.has(model)) return data;
  if (Array.isArray(data)) return data.map(row => applyClientToData(model, row, clientId));
  return { ...data, clientId };
}

module.exports = { applyClientToWhere, applyClientToData };
