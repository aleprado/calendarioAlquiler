import { getAuth } from '../firebaseAdmin'

const emailCache = new Map<string, string | null>()

const normalizeEmail = (email?: string | null) => {
  if (!email) return null
  const trimmed = email.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const getEmailsForUserIds = async (userIds: string[]): Promise<string[]> => {
  const uniqueIds = Array.from(new Set(userIds.filter((value) => typeof value === 'string' && value.trim().length > 0)))
  if (uniqueIds.length === 0) {
    return []
  }

  const auth = getAuth()
  const result: string[] = []
  const idsToFetch: string[] = []

  uniqueIds.forEach((id) => {
    if (emailCache.has(id)) {
      const cached = emailCache.get(id)
      if (cached) {
        result.push(cached)
      }
      return
    }
    idsToFetch.push(id)
  })

  if (idsToFetch.length > 0) {
    const batches = []
    const chunkSize = 100
    for (let index = 0; index < idsToFetch.length; index += chunkSize) {
      batches.push(idsToFetch.slice(index, index + chunkSize))
    }

    for (const batch of batches) {
      const { users } = await auth.getUsers(batch.map((uid) => ({ uid })))
      users.forEach((user) => {
        const email = normalizeEmail(user.email)
        emailCache.set(user.uid, email)
        if (email) {
          result.push(email)
        }
      })

      const fetchedIds = new Set(users.map((user) => user.uid))
      batch.forEach((id) => {
        if (!fetchedIds.has(id)) {
          emailCache.set(id, null)
        }
      })
    }
  }

  return result
}
