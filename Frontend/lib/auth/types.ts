export type AppRole = 'reader' | 'editor' | 'admin'

export type AuthStatus =
    | 'loading'
    | 'anonymous'
    | 'authenticating'
    | 'new-password-required'
    | 'authenticated'

export type AuthenticatedUser = {
    sub: string
    email: string
    role: AppRole
}

export type AuthSession = {
    user: AuthenticatedUser
    accessToken: string
}

export type AuthResult =
    | { kind: 'authenticated'; session: AuthSession }
    | { kind: 'new-password-required' }

export interface AuthClient {
    signIn(email: string, password: string): Promise<AuthResult>
    completeNewPassword(newPassword: string): Promise<AuthSession>
    restoreSession(): Promise<AuthSession | null>
    getAccessToken(): Promise<string>
    signOut(): void
}
