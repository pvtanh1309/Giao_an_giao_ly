import type { AuthContextValue } from '../../components/auth-provider.tsx'
import type { AuthStatus, AuthenticatedUser } from '../../lib/auth/types.ts'

type ExpectedAuthContext = {
    status: AuthStatus
    user: AuthenticatedUser | null
    error: string | null
    login(email: string, password: string): Promise<void>
    completeNewPassword(newPassword: string): Promise<void>
    logout(): void
    getAccessToken(): Promise<string>
}

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2) ? true : false

const contextContract: Equal<AuthContextValue, ExpectedAuthContext> = true
void contextContract
