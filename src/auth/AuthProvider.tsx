import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { getFirebaseAuth, googleProvider } from '../lib/firebase'
import { AuthContext, type AuthContextValue } from './AuthContext'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const auth = getFirebaseAuth()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [auth])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async () => {
        await signInWithPopup(auth, googleProvider)
      },
      signOut: async () => {
        await signOut(auth)
      },
    }),
    [auth, loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
