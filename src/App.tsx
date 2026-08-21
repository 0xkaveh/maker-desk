import { Navigate, Route, Routes } from 'react-router-dom'
import { BooksPage } from './pages/Books'
import { PacksPage } from './pages/Packs'
import { TradersPage } from './pages/Traders'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BooksPage />} />
      <Route path="/packs" element={<PacksPage />} />
      <Route path="/traders" element={<TradersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
