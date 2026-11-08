export function movementName(transaction) {
  if (transaction.kind === 'transfer') return 'Transfer'
  return transaction.vendor || transaction.category
}
