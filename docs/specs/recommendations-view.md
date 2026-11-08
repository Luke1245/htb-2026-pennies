# Recommendations view

The Recommendations screen teaches from the current Financial portrait. It leads with that portrait's Educations, each about the user's own spending, then offers the curated Guides and Resources those lessons point to. It opens from the dashboard's "See what Penny recommends for you" link, and the dashboard badges the Guide cards named by the current Recommendations.

- Show the portrait's Educations first, with the Suggestion that follows each one. A Guide link appears when the Education applies a Guide. Then show Recommendations as a ranked list. Guide picks open the Guide in the app; Resource picks open the publisher's page in a new tab.
- Load the stored Recommendations when the screen opens. Build the portrait when it is missing and there is an ordinary Transaction or logged Subscription.
- Recommendations are part of the Financial portrait: a new ordinary Transaction, Category change, Subscription change, or sharing-mode change replaces them, and a failed rebuild keeps the previous set and can be retried.
- The dashboard reads the stored Recommendations to badge Guides. A missing or unreadable reading means no badges; the dashboard itself keeps working.
- With no spending history, direct the user to add a Transaction. When the portrait offers nothing worth recommending, say so instead of filling the list.
