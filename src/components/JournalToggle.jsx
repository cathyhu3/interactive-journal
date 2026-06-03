import { useLocation, useNavigate, useParams } from 'react-router-dom'

export default function JournalToggle() {
  const { journalType } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  function switchTo(type) {
    if (type === journalType) return
    navigate(location.pathname.replace(/^\/(life|career)/, `/${type}`))
  }

  return (
    <div className="journal-toggle">
      <button
        className={`jtog-opt${journalType === 'life' ? ' jtog-active jtog-life' : ''}`}
        onClick={() => switchTo('life')}
      >
        Life
      </button>
      <button
        className={`jtog-opt${journalType === 'career' ? ' jtog-active jtog-career' : ''}`}
        onClick={() => switchTo('career')}
      >
        Career
      </button>
    </div>
  )
}
