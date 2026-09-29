export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

export function calculateMargin(price: number, cost: number): { value: number; percentage: number } {
  const value = price - cost;
  const percentage = price > 0 ? (value / price) * 100 : 0;
  return { value, percentage };
}
