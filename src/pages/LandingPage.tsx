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
      <header className="landing-hero">
        <h1>
          SimpleAlquiler<span>.net</span>
        </h1>
        <p>Gestiona tus propiedades y coordina reservas en un solo lugar.</p>
        <button type="button" className="primary" onClick={handleSignIn} disabled={loading}>
          {loading ? 'Cargando...' : 'Ingresar con Google'}
        </button>
        {error && <p className="alert alert--inline">{error}</p>}
      </header>
      <section className="landing-features">
        <h2>¿Qué puedes hacer?</h2>
        <ul>
          <li>Registrar múltiples propiedades y sincronizar con tu calendario de Airbnb.</li>
          <li>Ver todos los eventos en un calendario mensual expandido.</li>
          <li>Compartir un enlace público para recibir solicitudes de reserva.</li>
        </ul>
      </section>
    </div>
  )
}
