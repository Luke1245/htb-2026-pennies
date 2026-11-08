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
The total of ordinary outflows in the current Calendar month, plus logged Subscriptions for that month, without subtracting inflows. Transfers and Adjustments are excluded.

**Spending insights**:
The current Calendar month's ordinary outflows grouped by Category, shown beside the total of logged Subscriptions for that month.

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
Groceries, Transport, Eating out, Entertainment, Income, or Other, assigned once by Gemini to an ordinary Transaction (Other when it cannot choose) and changeable by the user. A Transfer is not categorised, an Adjustment uses the reserved Adjustment Category, and a Subscription has no Category.

**Spending habit**:
A pattern already visible in a user's historical spending, whether good or bad.

**Projected habit**:
A bad Spending habit Gemini expects if the user's current behaviour continues.
_Avoid_: Forecast, prediction

**Financial portrait**:
The account owner's single current read-only in-depth reading, under the active sharing mode, of their ordinary Transactions, logged Subscriptions, current Monthly budget, Left to spend, and the Account balances that mode allows. It names their Spending habits and Projected habits and states bold assumptions about what that history implies and where the same behaviour is heading; it is built once there is an ordinary Transaction or logged Subscription to read, including when Spending habits is opened and that reading is missing, and a new ordinary Transaction, Category change, Subscription change, or sharing-mode change replaces it.
_Avoid_: Profile, persona

**Guide**:
A short, curated financial-literacy article based on trusted sources, without AI generation or personalisation.
_Avoid_: Education guide, basic advice

**Education**:
A read-only, AI-generated explanation written from the user's Financial portrait. It names the Guide it applies, or the Category, Spending habit, or Projected habit it explains when no Guide covers that subject.

**Suggestion**:
A read-only personalised action written from the user's Financial portrait, following from a named Education and focused primarily on current-month patterns.

**Subscription**:
A monthly outflow the user logs apart from ordinary Transactions for one Calendar month: a name and a positive amount, with no Category. It counts towards Spent this month for that month, is part of the Financial portrait, and can shape Suggestions.

**Raw sharing**:
The default AI sharing mode. It includes each transaction's vendor or payee, amount, category, date, and note, each logged Subscription's name, amount, and Calendar month, plus Account names and calculated balances.

**Sanitised sharing**:
An AI sharing mode that includes only transaction amount, category, and calendar month, each logged Subscription's amount and Calendar month, plus calculated Account balances without their names.
