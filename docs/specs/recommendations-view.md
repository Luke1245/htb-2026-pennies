# Recommendations view

The Recommendations screen shows the personalised learning material chosen by the current Financial portrait: curated Guides and curated external Resources, most relevant first. It opens from the dashboard's "See what Pennies recommends for you" link, and the dashboard badges the Guide cards named by the current Recommendations.

- Show the portrait's Recommendations as a ranked list. Guide picks open the Guide in the app; Resource picks open the publisher's page in a new tab.
- Load the stored Recommendations when the screen opens. Build the portrait when it is missing and there is an ordinary Transaction or logged Subscription.
- Recommendations are part of the Financial portrait: a new ordinary Transaction, Category change, Subscription change, or sharing-mode change replaces them, and a failed rebuild keeps the previous set and can be retried.
- The dashboard reads the stored Recommendations to badge Guides. A missing or unreadable reading means no badges; the dashboard itself keeps working.
- With no spending history, direct the user to add a Transaction. When the portrait offers nothing worth recommending, say so instead of filling the list.
