# Signed transactions across user-owned accounts

Pennies stores every money movement as a signed GBP Transaction belonging to a user-owned Account with an opening balance. Transfers are atomic linked outflow/inflow pairs, while reconciliation Adjustments correct balances without counting as spending; this preserves useful balances without treating missing transactions as irresponsible behaviour. Monthly budgets are optional and stored per calendar month so later edits do not rewrite history.
