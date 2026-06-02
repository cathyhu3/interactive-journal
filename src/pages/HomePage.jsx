import { Link } from 'react-router-dom'

const MONTHS = [
  { name: 'January',   index: 0,  season: 'winter' },
  { name: 'February',  index: 1,  season: 'winter' },
  { name: 'March',     index: 2,  season: 'winter' },
  { name: 'April',     index: 3,  season: 'spring' },
  { name: 'May',       index: 4,  season: 'spring' },
  { name: 'June',      index: 5,  season: 'spring' },
  { name: 'July',      index: 6,  season: 'summer' },
  { name: 'August',    index: 7,  season: 'summer' },
  { name: 'September', index: 8,  season: 'summer' },
  { name: 'October',   index: 9,  season: 'fall'   },
  { name: 'November',  index: 10, season: 'fall'   },
  { name: 'December',  index: 11, season: 'fall'   },
]

export default function HomePage() {
  return (
    <div className="home">
      <h1>2026</h1>
      <div className="month-grid">
        {MONTHS.map((month) => (
          <Link
            key={month.index}
            to={`/month/${month.index}`}
            className={`month-card ${month.season}`}
          >
            {month.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
