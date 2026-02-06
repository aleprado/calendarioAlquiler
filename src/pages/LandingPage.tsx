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
      <main className="landing-main">
        <header className="landing-hero landing-hero--centered">
          <img src="/logo-vacacional.svg" alt="simplealquiler.net" className="landing-logo" />
          <h1>
            simplealquiler<span>.net</span>
          </h1>
          <p>Gestion profesional de alquileres vacacionales con calendario, web de promocion y reservas directas.</p>
          <button type="button" className="primary" onClick={handleSignIn} disabled={loading}>
            {loading ? 'Cargando...' : 'Ingresar con Google'}
          </button>
          {error && <p className="alert alert--inline">{error}</p>}
        </header>
        <section className="landing-features">
          <h2>Todo en un solo panel</h2>
          <ul>
            <li>Sincronizacion automatica de disponibilidad</li>
            <li>Pagina publica de promocion con mapa e imagenes</li>
            <li>Calendario de reservas separado y mas practico</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
