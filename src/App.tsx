import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { PublicPropertyPage } from './pages/PublicPropertyPage'
import { PublicPromoPage } from './pages/PublicPromoPage'

const LoadingScreen = () => (
  <div className="loading loading--fullscreen" role="status">
    Cargando...
  </div>
)

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/public/:publicSlug" element={<PublicPromoPage />} />
      <Route path="/public/:publicSlug/calendario" element={<PublicPropertyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
