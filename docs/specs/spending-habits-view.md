# Spending habits view

## Agreed frontend slice

Build the complete user-facing React experience using a demo generator. Live Gemini, Transaction APIs, and persistence across reloads are not part of this slice.

- Open a dedicated Spending habits page from the dashboard's Spending insights tile; retain the Category breakdown.
- Show up to three vertical cards with a title, concise explanation, evidence, and time period. Use plain, encouraging, non-judgemental language for teenagers.
- Include positive, neutral, concerning, and Emerging habits without forcing a mix. Emerging habits are tentative, evidence-based patterns framed as something to keep an eye on.
- Habits explain patterns rather than action plans. A gentle suggestion such as “This may be worth keeping an eye on” is allowed; detailed guidance belongs in Suggestions.
- Generate automatically on entry and when Transactions change. Show loading, last-updated information, and a retryable error that retains existing habits after ordinary failures.
- Locking preserves a habit's content and position during ordinary regeneration. Locked habits count towards the three-habit limit and can be unlocked or dismissed.
- Before changing sharing mode, warn that all habits, including Locked habits, will be discarded and regenerated. Sanitised mode explains that protected details may make habits less specific.
- Dismissal hides the underlying pattern and similar habits for a week, a month, or indefinitely. Offer Undo for a few seconds. Dismissals survive sharing-mode changes.
- With no Transactions, direct users to add a Transaction. With insufficient meaningful evidence, do not invent habits; limited evidence may produce a cautious Emerging habit.
- Do not add archives, sharing, exporting, or Category customisation.
