import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import type { WorkerEnv } from './env'

export function googleCredentials(env: WorkerEnv) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env
  return clientId && clientSecret ? { clientId, clientSecret } : undefined
}

export function authFor(env: WorkerEnv, url: URL) {
  const local = ['localhost', '127.0.0.1', '[::1]', 'terminal.local'].includes(url.hostname)
  const baseURL = env.BETTER_AUTH_URL || (local ? url.origin : undefined)
  if (!baseURL || !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('Configure BETTER_AUTH_SECRET and the public BETTER_AUTH_URL.')
  }

  const google = googleCredentials(env)
  return betterAuth({
    appName: 'Whiteboard',
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    emailAndPassword: { enabled: true },
    socialProviders: google ? { google } : {},
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      useSecureCookies: new URL(baseURL).protocol === 'https:',
    },
    rateLimit: { enabled: !local, storage: 'database' },
    plugins: [username()],
  })
}
