import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import MonthPage from './pages/MonthPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/month/:monthIndex" element={<MonthPage />} />
    </Routes>
  )
}
