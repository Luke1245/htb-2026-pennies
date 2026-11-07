import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './dashboard.css'
import { GuideCards, GuideView } from './Guides.jsx'
import { guides } from './guides.js'

// DUMMY - delete this object when real data is wired up.
const dummy = {
  spentThisMonth: '£642',
  leftToSpend: '£358',
  transactions: [
    { merchant: 'Tesco', when: 'Today', amount: '-£18.40' },
    { merchant: 'Lothian Buses', when: 'Yesterday', amount: '-£2.00' },
    { merchant: 'Salary', when: 'Mon', amount: '+£1,850' },
    { merchant: 'Cafe', when: 'Mon', amount: '-£4.60' },
  ],
  categories: [
    { name: 'Groceries', amount: '£186', share: 72 },
    { name: 'Bills', amount: '£210', share: 80 },
    { name: 'Eating out', amount: '£91', share: 40 },
    { name: 'Transport', amount: '£64', share: 28 },
  ],
}

function greetingFor(date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user, logout } = useAuth0()
  const [selectedGuide, setSelectedGuide] = useState(null)
  const greeting = greetingFor(new Date())
  const name = user?.given_name || user?.name || 'Elodie'

  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
        <button
          type="button"
          className="logout"
          onClick={() =>
            logout({ logoutParams: { returnTo: window.location.origin } })
          }
        >
          Log out
        </button>
      </header>
      <main className="dashboard-main">
        {selectedGuide ? (
          <GuideView guide={selectedGuide} onBack={() => setSelectedGuide(null)} />
        ) : (
          <>
            <p className="greeting">
          {greeting}, {name}
        </p>
        <div className="tiles">
          <section className="tile">
            <h2>Spent this month</h2>
            <p className="stat">{dummy.spentThisMonth}</p>
          </section>
          <section className="tile">
            <h2>Left to spend</h2>
            <p className="stat">{dummy.leftToSpend}</p>
          </section>
          <section className="tile">
            <h2>Spending insights</h2>
            <ul className="bars">
              {dummy.categories.map((category) => (
                <li key={category.name}>
                  <span>{category.name}</span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${category.share}%` }} />
                  </span>
                  <span>{category.amount}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="tile">
            <h2>Recent transactions</h2>
            <ul className="transactions">
              {dummy.transactions.map((transaction) => (
                <li key={transaction.merchant}>
                  <span>
                    {transaction.merchant}
                    <small>{transaction.when}</small>
                  </span>
                  <span>{transaction.amount}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
            <GuideCards guides={guides} onSelect={setSelectedGuide} />
          </>
        )}
      </main>
    </div>
  )
}
