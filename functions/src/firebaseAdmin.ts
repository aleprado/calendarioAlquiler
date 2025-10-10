import admin from 'firebase-admin'

let initialized = false

export const getFirebaseAdmin = () => {
  if (!initialized) {
    admin.initializeApp()
    initialized = true
  }
  return admin
}

export type FirebaseAdmin = ReturnType<typeof getFirebaseAdmin>

export const getAuth = () => getFirebaseAdmin().auth()
