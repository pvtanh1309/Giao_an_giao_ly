import {
    AuthenticationDetails,
    CognitoUser,
    CognitoUserPool,
} from 'amazon-cognito-identity-js'

import type { PublicConfig } from '../config'
import { sessionClaimsToUser } from './claims.ts'
import type { AuthClient, AuthResult, AuthSession } from './types'

type TokenPort = {
    decodePayload(): unknown
    getJwtToken(): string
}

type SessionPort = {
    getAccessToken(): TokenPort
    getIdToken(): Pick<TokenPort, 'decodePayload'>
}

type AuthenticationCallbacks = {
    onSuccess(session: SessionPort): void
    onFailure(error: unknown): void
    newPasswordRequired?(userAttributes: unknown, requiredAttributes: unknown): void
}

type CognitoUserPort = {
    setAuthenticationFlowType(authenticationFlowType: string): string
    authenticateUser(details: unknown, callbacks: AuthenticationCallbacks): void
    completeNewPasswordChallenge(
        newPassword: string,
        requiredAttributes: Record<string, never>,
        callbacks: AuthenticationCallbacks,
    ): void
    getSession(callback: (error: Error | null, session: SessionPort | null) => void): void
    signOut(): void
}

type CognitoUserPoolPort = {
    getCurrentUser(): CognitoUserPort | null
}

export type CognitoSdkPort = {
    CognitoUserPool: new (data: {
        UserPoolId: string
        ClientId: string
        Storage: Storage
    }) => CognitoUserPoolPort
    CognitoUser: new (data: {
        Username: string
        Pool: CognitoUserPoolPort
        Storage: Storage
    }) => CognitoUserPort
    AuthenticationDetails: new (data: { Username: string; Password: string }) => unknown
}

const defaultSdk = {
    AuthenticationDetails,
    CognitoUser,
    CognitoUserPool,
} as unknown as CognitoSdkPort

function getBrowserStorage(): Storage {
    if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('Không thể khởi tạo đăng nhập ngoài trình duyệt.')
    }
    return window.localStorage
}

function toAuthSession(session: SessionPort): AuthSession {
    const accessToken = session.getAccessToken()
    const jwt = accessToken.getJwtToken()
    if (!jwt) throw new Error('Phiên đăng nhập không hợp lệ.')

    return {
        accessToken: jwt,
        user: sessionClaimsToUser(
            accessToken.decodePayload(),
            session.getIdToken().decodePayload(),
        ),
    }
}

function readSession(user: CognitoUserPort): Promise<AuthSession> {
    return new Promise((resolve, reject) => {
        user.getSession((error, session) => {
            if (error || !session) {
                reject(new Error('Phiên đăng nhập đã hết hạn.'))
                return
            }

            try {
                resolve(toAuthSession(session))
            } catch (sessionError) {
                reject(sessionError)
            }
        })
    })
}

export function createCognitoAuth(
    config: PublicConfig,
    options: { storage?: Storage; sdk?: CognitoSdkPort } = {},
): AuthClient {
    const storage = options.storage ?? getBrowserStorage()
    const sdk = options.sdk ?? defaultSdk
    const pool = new sdk.CognitoUserPool({
        UserPoolId: config.cognitoUserPoolId,
        ClientId: config.cognitoClientId,
        Storage: storage,
    })
    let activeUser: CognitoUserPort | null = null
    let challengedUser: CognitoUserPort | null = null

    const clearUser = (user: CognitoUserPort | null) => {
        user?.signOut()
        if (activeUser === user) activeUser = null
        if (challengedUser === user) challengedUser = null
    }

    return {
        signIn(email, password) {
            const user = new sdk.CognitoUser({ Username: email, Pool: pool, Storage: storage })
            const details = new sdk.AuthenticationDetails({ Username: email, Password: password })
            user.setAuthenticationFlowType('USER_PASSWORD_AUTH')

            return new Promise<AuthResult>((resolve, reject) => {
                user.authenticateUser(details, {
                    onSuccess(session) {
                        challengedUser = null
                        try {
                            const authSession = toAuthSession(session)
                            activeUser = user
                            resolve({ kind: 'authenticated', session: authSession })
                        } catch (error) {
                            clearUser(user)
                            reject(error)
                        }
                    },
                    onFailure() {
                        challengedUser = null
                        activeUser = null
                        reject(new Error('Không thể đăng nhập. Vui lòng kiểm tra email và mật khẩu.'))
                    },
                    newPasswordRequired() {
                        activeUser = null
                        challengedUser = user
                        resolve({ kind: 'new-password-required' })
                    },
                })
            })
        },

        completeNewPassword(newPassword) {
            const user = challengedUser
            if (!user) return Promise.reject(new Error('Không có yêu cầu đặt mật khẩu mới.'))

            return new Promise<AuthSession>((resolve, reject) => {
                user.completeNewPasswordChallenge(newPassword, {}, {
                    onSuccess(session) {
                        challengedUser = null
                        try {
                            const authSession = toAuthSession(session)
                            activeUser = user
                            resolve(authSession)
                        } catch (error) {
                            clearUser(user)
                            reject(error)
                        }
                    },
                    onFailure() {
                        reject(new Error('Không thể đặt mật khẩu mới. Vui lòng thử lại.'))
                    },
                })
            })
        },

        async restoreSession() {
            const user = pool.getCurrentUser()
            if (!user) return null

            try {
                const session = await readSession(user)
                activeUser = user
                return session
            } catch {
                clearUser(user)
                return null
            }
        },

        async getAccessToken() {
            const user = pool.getCurrentUser() ?? activeUser
            if (!user) throw new Error('Phiên đăng nhập đã hết hạn.')

            try {
                return (await readSession(user)).accessToken
            } catch (error) {
                clearUser(user)
                throw error
            }
        },

        signOut() {
            const users = new Set([pool.getCurrentUser(), activeUser, challengedUser])
            for (const user of users) user?.signOut()
            activeUser = null
            challengedUser = null
        },
    }
}
