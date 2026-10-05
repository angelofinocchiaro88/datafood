const test = require("node:test");
const assert = require("node:assert/strict");
const { applyClientToData, applyClientToWhere } = require("./lib/tenant-scope.cjs");

test("tenant id overrides hard-coded defaults in direct model filters", () => {
  assert.deepEqual(
    applyClientToWhere("Sale", { clientId: "default", date: { gte: "2026-01-01" } }, "restaurant-b"),
    { clientId: "restaurant-b", date: { gte: "2026-01-01" } },
  );
});

test("tenant filters scope rows that are related to another table", () => {
  assert.deepEqual(
    applyClientToWhere("SaleItem", { dishId: { not: null }, sale: { date: { gte: "2026-01-01" } } }, "restaurant-b"),
    { dishId: { not: null }, sale: { date: { gte: "2026-01-01" } }, clientId: "restaurant-b" },
  );
});

test("compound budget filters replace the tenant inside the unique key", () => {
  assert.deepEqual(
    applyClientToWhere("BudgetTarget", { year_month_clientId: { year: 2026, month: 10, clientId: "default" } }, "restaurant-b"),
    { year_month_clientId: { year: 2026, month: 10, clientId: "restaurant-b" } },
  );
});

test("compound fiscal-year filters are tenant specific", () => {
  assert.deepEqual(
    applyClientToWhere("FiscalYear", { year_clientId: { year: 2026, clientId: "default" } }, "restaurant-b"),
    { year_clientId: { year: 2026, clientId: "restaurant-b" } },
  );
});

test("tenant is stamped on single and bulk create payloads", () => {
  assert.deepEqual(applyClientToData("Dish", { name: "Piatto", clientId: "default" }, "restaurant-b"), { name: "Piatto", clientId: "restaurant-b" });
  assert.deepEqual(applyClientToData("Sale", [{ amount: 10 }, { amount: 20, clientId: "default" }], "restaurant-b"), [
    { amount: 10, clientId: "restaurant-b" },
    { amount: 20, clientId: "restaurant-b" },
  ]);
});

test("denormalized tenant key is set on relational records during creation", () => {
  assert.deepEqual(applyClientToData("Order", { supplierId: "supplier-b" }, "restaurant-b"), { supplierId: "supplier-b", clientId: "restaurant-b" });
});
