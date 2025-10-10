import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export const LandingPage = () => {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, navigate, user])

  const handleSignIn = async () => {
    setError(null)
    try {
      await signIn()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    }
  }

  return (
    <div className="landing-layout">
      <header className="landing-hero landing-hero--centered">
        <h1>
          SimpleAlquiler<span>.net</span>
        </h1>
        <p>Gestiona tus propiedades y coordina reservas en un solo lugar.</p>
        <button type="button" className="primary" onClick={handleSignIn} disabled={loading}>
          {loading ? 'Cargando...' : 'Ingresar con Google'}
        </button>
        {error && <p className="alert alert--inline">{error}</p>}
      </header>
    </div>
  )
}
