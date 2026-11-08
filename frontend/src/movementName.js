export function movementName(transaction) {
  if (transaction.kind === 'transfer') return 'Transfer'
  return transaction.vendor || transaction.category
}

export function accountNamesById(accounts) {
  if (!Array.isArray(accounts)) return {}
  return Object.fromEntries(accounts.map((account) => [account.id, account.name]))
}

export function transactionDetail(transaction, accountName, when) {
  const parts = []
  if (accountName) parts.push(accountName)
  if (transaction.vendor) parts.push(transaction.category)
  if (when) parts.push(when)
  return parts.join(' · ')
}
