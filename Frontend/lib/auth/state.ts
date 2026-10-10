import type { AuthClient, AuthSession, AuthStatus, AuthenticatedUser } from './types'

export type AuthState = {
    status: AuthStatus
    user: AuthenticatedUser | null
    error: string | null
}

export type AuthAction =
    | { type: 'RESTORE_ANONYMOUS'; error: string | null }
    | { type: 'AUTHENTICATING' }
    | { type: 'AUTHENTICATED'; session: AuthSession }
    | { type: 'NEW_PASSWORD_REQUIRED' }
    | { type: 'AUTH_FAILURE'; error: string }
    | { type: 'CHALLENGE_FAILURE'; error: string }
    | { type: 'LOGOUT' }
    | { type: 'UNAUTHORIZED' }

export const initialAuthState: AuthState = {
    status: 'loading',
    user: null,
    error: null,
}

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
    switch (action.type) {
        case 'RESTORE_ANONYMOUS':
            return { status: 'anonymous', user: null, error: action.error }
        case 'AUTHENTICATING':
            return { status: 'authenticating', user: null, error: null }
        case 'AUTHENTICATED':
            return { status: 'authenticated', user: action.session.user, error: null }
        case 'NEW_PASSWORD_REQUIRED':
            return { status: 'new-password-required', user: null, error: null }
        case 'AUTH_FAILURE':
            return { status: 'anonymous', user: null, error: action.error }
        case 'CHALLENGE_FAILURE':
            return { status: 'new-password-required', user: null, error: action.error }
        case 'LOGOUT':
            return { status: 'anonymous', user: null, error: null }
        case 'UNAUTHORIZED':
            return { status: 'anonymous', user: null, error: 'Phiên đăng nhập đã hết hạn.' }
    }
}

export async function restoreAuthSession(client: AuthClient): Promise<AuthAction> {
    try {
        const session = await client.restoreSession()
        return session
            ? { type: 'AUTHENTICATED', session }
            : { type: 'RESTORE_ANONYMOUS', error: null }
    } catch {
        return { type: 'RESTORE_ANONYMOUS', error: 'Không thể khôi phục phiên đăng nhập.' }
    }
}

export async function loginAuthSession(
    client: AuthClient,
    email: string,
    password: string,
): Promise<AuthAction> {
    try {
        const result = await client.signIn(email, password)
        return result.kind === 'authenticated'
            ? { type: 'AUTHENTICATED', session: result.session }
            : { type: 'NEW_PASSWORD_REQUIRED' }
    } catch {
        return { type: 'AUTH_FAILURE', error: 'Không thể đăng nhập. Vui lòng kiểm tra email và mật khẩu.' }
    }
}

export async function completeNewPasswordAuthSession(
    client: AuthClient,
    newPassword: string,
): Promise<AuthAction> {
    try {
        return { type: 'AUTHENTICATED', session: await client.completeNewPassword(newPassword) }
    } catch {
        return { type: 'CHALLENGE_FAILURE', error: 'Không thể đặt mật khẩu mới. Vui lòng thử lại.' }
    }
}

export function invalidateAuthSession(client: AuthClient): AuthAction {
    client.signOut()
    return { type: 'UNAUTHORIZED' }
}

export async function getAccessTokenAuthSession(
    client: AuthClient,
    dispatch: (action: AuthAction) => void,
): Promise<string> {
    try {
        return await client.getAccessToken()
    } catch {
        dispatch(invalidateAuthSession(client))
        throw new Error('Phiên đăng nhập đã hết hạn.')
    }
}
