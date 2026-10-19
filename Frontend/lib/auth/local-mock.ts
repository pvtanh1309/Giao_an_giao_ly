import type { AuthClient, AuthResult, AuthSession } from './types'

const SESSION_KEY = 'giaoan.local-auth.session'
const MOCK_ACCESS_TOKEN = 'local-mock-token-do-not-send-to-api'

type LocalMockConfig = { email: string; password: string }

export function createLocalMockAuth(config: LocalMockConfig): AuthClient {
    const email = config.email.trim().toLocaleLowerCase()

    const readSession = (): AuthSession | null => {
        if (typeof window === 'undefined') return null
        try {
            const value = window.localStorage.getItem(SESSION_KEY)
            if (!value) return null
            const session = JSON.parse(value) as AuthSession
            if (session.user?.localMock !== true || session.user.email !== email) return null
            if (session.user.role !== 'admin') {
                session.user.role = 'admin'
                window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
            }
            return session
        } catch {
            return null
        }
    }

    return {
        async signIn(inputEmail, inputPassword): Promise<AuthResult> {
            if (inputEmail.trim().toLocaleLowerCase() !== email || inputPassword !== config.password) {
                throw new Error('Invalid local demo credentials')
            }
            const session: AuthSession = {
                user: { sub: 'local-reader', email: config.email.trim(), role: 'admin', localMock: true },
                accessToken: MOCK_ACCESS_TOKEN,
            }
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
            return { kind: 'authenticated', session }
        },
        async completeNewPassword(): Promise<AuthSession> {
            throw new Error('Local demo account has no password challenge')
        },
        async restoreSession() {
            return readSession()
        },
        async getAccessToken() {
            if (!readSession()) throw new Error('Local demo session is missing')
            return MOCK_ACCESS_TOKEN
        },
        signOut() {
            if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_KEY)
        },
    }
}
