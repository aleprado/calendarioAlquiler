import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { PublicPropertyPage } from './pages/PublicPropertyPage'

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

export const App = () => (
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
    <Route path="/public/:publicSlug" element={<PublicPropertyPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export default App
