import './dashboard.css'

function greetingFor(date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const greeting = greetingFor(new Date())

  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
      </header>
      <main className="dashboard-main">
        <p className="greeting">{greeting}, Elodie</p>
      </main>
    </div>
  )
}
