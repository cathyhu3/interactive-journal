import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import MonthPage from './pages/MonthPage'
import LogPage from './pages/LogPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/month/:monthIndex" element={<MonthPage />} />
      <Route path="/month/:monthIndex/log/:logType" element={<LogPage />} />
    </Routes>
  )
}
