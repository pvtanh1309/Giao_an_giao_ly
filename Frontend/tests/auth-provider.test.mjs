import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
    authReducer,
    completeNewPasswordAuthSession,
    initialAuthState,
    invalidateAuthSession,
    loginAuthSession,
    restoreAuthSession,
} from '../lib/auth/state.ts'

const user = { sub: 'user-1', email: 'reader@example.test', role: 'reader' }
const session = { user, accessToken: 'access-token' }

function client(overrides = {}) {
    return {
        signIn: async () => ({ kind: 'authenticated', session }),
        completeNewPassword: async () => session,
        restoreSession: async () => null,
        getAccessToken: async () => 'access-token',
        signOut: () => {},
        ...overrides,
    }
}

test('reducer covers restore, authentication, challenge, failure, logout, and unauthorized transitions', () => {
    assert.deepEqual(authReducer(initialAuthState, { type: 'RESTORE_ANONYMOUS', error: null }), {
        status: 'anonymous', user: null, error: null,
    })
    assert.deepEqual(authReducer(initialAuthState, { type: 'AUTHENTICATED', session }), {
        status: 'authenticated', user, error: null,
    })
    assert.equal(authReducer({ status: 'anonymous', user: null, error: null }, { type: 'AUTHENTICATING' }).status, 'authenticating')
    assert.equal(authReducer({ status: 'authenticating', user: null, error: null }, { type: 'NEW_PASSWORD_REQUIRED' }).status, 'new-password-required')
    assert.deepEqual(authReducer(
        { status: 'authenticating', user: null, error: null },
        { type: 'AUTH_FAILURE', error: 'Không thể đăng nhập.' },
    ), { status: 'anonymous', user: null, error: 'Không thể đăng nhập.' })
    assert.deepEqual(authReducer(
        { status: 'authenticating', user: null, error: null },
        { type: 'CHALLENGE_FAILURE', error: 'Không thể đặt mật khẩu mới.' },
    ), { status: 'new-password-required', user: null, error: 'Không thể đặt mật khẩu mới.' })
    assert.equal(authReducer({ status: 'authenticated', user, error: null }, { type: 'LOGOUT' }).status, 'anonymous')
    assert.deepEqual(authReducer(
        { status: 'authenticated', user, error: null },
        { type: 'UNAUTHORIZED' },
    ), { status: 'anonymous', user: null, error: 'Phiên đăng nhập đã hết hạn.' })
})

test('restore helper returns authenticated or anonymous actions and hides internal errors', async () => {
    assert.deepEqual(await restoreAuthSession(client({ restoreSession: async () => session })), { type: 'AUTHENTICATED', session })
    assert.deepEqual(await restoreAuthSession(client()), { type: 'RESTORE_ANONYMOUS', error: null })
    assert.deepEqual(
        await restoreAuthSession(client({ restoreSession: async () => { throw new Error('token=private-token') } })),
        { type: 'RESTORE_ANONYMOUS', error: 'Không thể khôi phục phiên đăng nhập.' },
    )
})

test('login helper returns authenticated, challenge, and safe failure actions', async () => {
    assert.deepEqual(await loginAuthSession(client(), 'reader@example.test', 'password'), { type: 'AUTHENTICATED', session })
    assert.deepEqual(
        await loginAuthSession(client({ signIn: async () => ({ kind: 'new-password-required' }) }), 'reader@example.test', 'temporary'),
        { type: 'NEW_PASSWORD_REQUIRED' },
    )
    const failed = await loginAuthSession(
        client({ signIn: async () => { throw new Error('password=secret token=private') } }),
        'reader@example.test',
        'secret',
    )
    assert.equal(failed.type, 'AUTH_FAILURE')
    assert.doesNotMatch(failed.error, /secret|private|token|password/i)
})

test('new-password completion succeeds or leaves the challenge retryable with a safe error', async () => {
    assert.deepEqual(await completeNewPasswordAuthSession(client(), 'new-password'), { type: 'AUTHENTICATED', session })
    const failed = await completeNewPasswordAuthSession(
        client({ completeNewPassword: async () => { throw new Error('new-password token') } }),
        'new-password',
    )
    assert.equal(failed.type, 'CHALLENGE_FAILURE')
    assert.doesNotMatch(failed.error, /new-password|token/i)
})

test('unauthorized invalidation signs out locally and returns the reducer action', () => {
    let signOuts = 0
    assert.deepEqual(invalidateAuthSession(client({ signOut: () => { signOuts += 1 } })), { type: 'UNAUTHORIZED' })
    assert.equal(signOuts, 1)
})

test('provider restores in an effect and its context matches the public contract', async () => {
    const source = await readFile(new URL('../components/auth-provider.tsx', import.meta.url), 'utf8')
    assert.match(source, /useEffect\s*\(/)
    assert.match(source, /restoreAuthSession\s*\(/)

    const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url))
    const contract = fileURLToPath(new URL('./type-contracts/auth-provider.ts', import.meta.url))
    const result = spawnSync(process.execPath, [
        tsc, '--noEmit', '--strict', '--skipLibCheck', '--jsx', 'react-jsx',
        '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler',
        '--allowImportingTsExtensions', contract,
    ], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
})
