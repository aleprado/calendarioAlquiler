export const config = {
  basicAuthUser: process.env.BASIC_AUTH_USER ?? '',
  basicAuthPassword: process.env.BASIC_AUTH_PASSWORD ?? '',
  allowUnauthenticated: process.env.ALLOW_UNAUTHENTICATED === 'true',
  defaultPropertyId: process.env.DEFAULT_PROPERTY_ID ?? 'default-property',
}

export const requireAuth = () => {
  if (!config.basicAuthUser || !config.basicAuthPassword) {
    throw new Error('Faltan las variables de entorno BASIC_AUTH_USER/BASIC_AUTH_PASSWORD en la función.')
  }
}
