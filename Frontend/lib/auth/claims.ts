import type { AppRole, AuthenticatedUser } from './types'

const rolePrecedence: AppRole[] = ['admin', 'editor', 'reader']

export function resolveAppRole(groups: unknown): AppRole | null {
    if (!Array.isArray(groups)) return null

    return rolePrecedence.find((role) => groups.includes(role)) ?? null
}

function asClaims(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Phiên đăng nhập không hợp lệ.')
    }
    return value as Record<string, unknown>
}

export function sessionClaimsToUser(accessPayload: unknown, idPayload: unknown): AuthenticatedUser {
    const accessClaims = asClaims(accessPayload)
    const idClaims = asClaims(idPayload)
    const sub = typeof accessClaims.sub === 'string' ? accessClaims.sub.trim() : ''
    const email = typeof idClaims.email === 'string' ? idClaims.email.trim() : ''

    if (!sub || !email) throw new Error('Phiên đăng nhập không hợp lệ.')

    const role = resolveAppRole(accessClaims['cognito:groups'])
    if (!role) throw new Error('Tài khoản chưa được cấp quyền truy cập.')

    return { sub, email, role }
}
