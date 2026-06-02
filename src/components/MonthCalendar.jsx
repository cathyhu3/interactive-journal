import { useMemo } from 'react'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MonthCalendar({ monthIndex, entries, onDayClick }) {
  const firstDay = new Date(2026, monthIndex, 1).getDay()
  const totalDays = new Date(2026, monthIndex + 1, 0).getDate()

  const cells = useMemo(() => {
    const arr = []
    for (let i = 0; i < firstDay; i++) arr.push(null)
    for (let d = 1; d <= totalDays; d++) arr.push(d)
    return arr
  }, [firstDay, totalDays])

  return (
    <div className="calendar">
      <div className="cal-header">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="cal-head-cell">{h}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((day, i) => {
          const text = day ? (entries[day]?.text || '') : ''
          const hasEntry = !!text
          const snippet = hasEntry ? text.split('\n')[0].slice(0, 28) : ''
          return (
            <div
              key={i}
              className={[
                'cal-cell',
                day ? 'cal-day' : 'cal-empty',
                hasEntry ? 'cal-has-entry' : '',
              ].join(' ')}
              onClick={() => day && onDayClick(day)}
            >
              {day && (
                <>
                  <span className="cal-day-num">{day}</span>
                  {snippet && (
                    <span className="cal-entry-preview">{snippet}</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
