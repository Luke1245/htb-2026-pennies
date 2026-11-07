# Pennies

Pennies is a private personal spending tracker centred on AI-generated suggestions and educational guidance.

## Language

**Transaction**:
A user-owned movement of money recorded at a specific moment in the Europe/London timezone, with a signed amount and an optional note. An ordinary inflow or outflow also names a Vendor. The amount is negative for an outflow and positive for an inflow.

**Vendor**:
The outside party named on an ordinary inflow or outflow, such as a shop or an employer. Required there. A Transfer has none. An Adjustment uses the Vendor "Adjustment".

**Calendar month**:
A month in the Europe/London timezone. Spent this month and a Monthly budget both use it.

**Inflow**:
Money received by the user, represented by a positive Transaction amount.

**Outflow**:
Money paid out by the user, represented by a negative Transaction amount.

**Account**:
A user-owned place money is held, such as cash or a bank account, without an external connection or synchronised balance.

**Spent this month**:
The total value of non-transfer, non-adjustment outflow Transactions occurring in the current Calendar month, without subtracting inflows.

**Transfer**:
Two linked Transactions representing money moved between the user's own Accounts: an outflow from the source and an inflow to the destination, neither counted as spending.

**Adjustment**:
A Transaction in the reserved Adjustment Category that corrects an Account's calculated balance to match its real balance.

**Reconciliation**:
The process of comparing an Account's calculated balance with its real balance and creating an Adjustment for the difference.

**Left to spend**:
When a Monthly budget exists, that budget minus Spent this month; a negative value represents overspending. Without a Monthly budget, it is displayed as £0.

**Monthly budget**:
An optional spending limit assigned to one Calendar month; later edits do not alter other months, and a new month may copy the previous month's value.

**Category**:
A classification from Pennies' predefined list, assigned to every Transaction by AI and changeable by the user.

**Spending habit**:
An AI-generated summary of a pattern in a user's historical spending behaviour.

**Guide**:
A short, curated financial-literacy article based on trusted sources, without AI generation or personalisation.
_Avoid_: Education guide, basic advice

**Education**:
AI-generated financial-learning content that explains a concept relevant to the user's situation.

**Suggestion**:
A personalised educational action generated automatically by AI as the user uses Pennies, based on their full transaction history filtered through their chosen sharing mode and focused primarily on current-month patterns.

**Subscription**:
A recurring financial commitment for which the user manually records each monthly outflow; it does not count as spending by itself.

**Raw sharing**:
An AI sharing mode that includes each transaction's vendor or payee, amount, category, date, and note, plus Account names and calculated balances.

**Sanitised sharing**:
An AI sharing mode that includes only transaction amount, category, and calendar month, plus calculated Account balances without their names.
