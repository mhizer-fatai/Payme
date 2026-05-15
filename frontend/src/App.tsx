import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/Home'
import PayPage from './pages/Pay'
import DashboardPage from './pages/Dashboard'
import ProfilePage from './pages/Profile'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pay/:linkId" element={<PayPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/u/:username" element={<ProfilePage />} />
    </Routes>
  )
}
