type CashAccount = { id: string; openingBalance?: number | null; openingBalanceDate?: Date | string | null; openingBalanceConfirmed?: boolean };
type CashMovement = { accountId: string; amount: number; date: Date | string };

export function accountCashPosition(account: CashAccount, transactions: CashMovement[]) {
  const movementStart = account.openingBalanceConfirmed && account.openingBalanceDate
    ? new Date(account.openingBalanceDate)
    : null;
  if (movementStart) movementStart.setDate(movementStart.getDate() + 1);
  return (account.openingBalance || 0) + transactions
    .filter(transaction => transaction.accountId === account.id && (!movementStart || new Date(transaction.date) >= movementStart))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function totalCashPosition(accounts: CashAccount[], transactions: CashMovement[]) {
  return accounts.reduce((sum, account) => sum + accountCashPosition(account, transactions), 0);
}
