import { calcRicavoNettoRiga } from "@/lib/metrics";

export type SaleFinancials = {
  grossRevenue: number;
  netRevenue: number | null;
  knownNetRevenue: number;
  taxAmount: number | null;
  basis: "sale_items" | "verified_tax" | "unknown";
  itemGrossRevenue: number;
  reconciliationDelta: number | null;
};

/**
 * Unifies the sales-side revenue basis used by Sales, Revenue Management,
 * Cost Control and the Dashboard. Header-only receipts without a verified
 * tax amount are deliberately not presented as net revenue.
 */
export function calculateSaleFinancials(sale: {
  total: number;
  taxAmount?: number | null;
  taxAmountKnown?: boolean;
  items?: Array<{ totalPrice: number; vatRate: number; vatRateKnown?: boolean }>;
}): SaleFinancials {
  const grossRevenue = Number.isFinite(sale.total) ? sale.total : 0;
  const items = sale.items || [];
  const itemGrossRevenue = items.reduce((sum, item) => sum + (Number.isFinite(item.totalPrice) ? item.totalPrice : 0), 0);

  if (items.length > 0) {
    if (items.some(item => item.vatRateKnown === false)) {
      const knownNetRevenue = items.filter(item => item.vatRateKnown !== false).reduce((sum, item) => sum + calcRicavoNettoRiga(item.totalPrice, item.vatRate), 0);
      return {
        grossRevenue,
        netRevenue: null,
        knownNetRevenue,
        taxAmount: null,
        basis: "unknown",
        itemGrossRevenue,
        reconciliationDelta: grossRevenue - itemGrossRevenue,
      };
    }
    const netRevenue = items.reduce((sum, item) => sum + calcRicavoNettoRiga(item.totalPrice, item.vatRate), 0);
    return {
      grossRevenue,
      netRevenue,
      knownNetRevenue: netRevenue,
      taxAmount: itemGrossRevenue - netRevenue,
      basis: "sale_items",
      itemGrossRevenue,
      reconciliationDelta: grossRevenue - itemGrossRevenue,
    };
  }

  if (sale.taxAmountKnown === true) {
    const taxAmount = Number(sale.taxAmount || 0);
    return {
      grossRevenue,
      netRevenue: Math.max(0, grossRevenue - taxAmount),
      knownNetRevenue: Math.max(0, grossRevenue - taxAmount),
      taxAmount,
      basis: "verified_tax",
      itemGrossRevenue: 0,
      reconciliationDelta: null,
    };
  }

  return {
    grossRevenue,
    netRevenue: null,
    knownNetRevenue: 0,
    taxAmount: null,
    basis: "unknown",
    itemGrossRevenue: 0,
    reconciliationDelta: null,
  };
}
