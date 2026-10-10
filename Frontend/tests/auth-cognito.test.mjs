import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAppRole, sessionClaimsToUser } from '../lib/auth/claims.ts'
import { createCognitoAuth } from '../lib/auth/cognito.ts'

const config = {
    awsRegion: 'ap-southeast-1',
    cognitoUserPoolId: 'ap-southeast-1_example',
    cognitoClientId: 'client-id',
    contentApiUrl: 'https://content.example.test',
    usersApiUrl: 'https://users.example.test',
}

function createStorage() {
    const entries = new Map()
    return {
        setItem: (key, value) => entries.set(key, value),
        getItem: (key) => entries.get(key) ?? null,
        removeItem: (key) => entries.delete(key),
        clear: () => entries.clear(),
    }
}

function session({ groups = ['reader'], sub = 'user-1', email = 'user@example.test', token = 'access-token' } = {}) {
    return {
        getAccessToken: () => ({ getJwtToken: () => token, decodePayload: () => ({ sub, 'cognito:groups': groups }) }),
        getIdToken: () => ({ decodePayload: () => ({ email }) }),
    }
}

function createFakeSdk() {
    const state = {
        authMode: 'success',
        authSession: session(),
        completeMode: 'success',
        completeSession: session({ token: 'new-password-token' }),
        currentUser: null,
        poolData: null,
        authDetails: null,
        signOuts: 0,
        completions: [],
    }

    class CognitoUserPool {
        constructor(data) { state.poolData = data }
        getCurrentUser() { return state.currentUser }
    }

    class CognitoUser {
        constructor(data) {
            this.data = data
            this.sessionResult = state.authSession
            this.sessionError = null
            state.lastUser = this
        }

        authenticateUser(details, callbacks) {
            state.authDetails = details
            if (state.authMode === 'failure') callbacks.onFailure(new Error('UserNotFoundException: private detail'))
            else if (state.authMode === 'challenge') callbacks.newPasswordRequired?.({}, [])
            else callbacks.onSuccess(state.authSession)
        }

        completeNewPasswordChallenge(password, attributes, callbacks) {
            state.completions.push({ user: this, password, attributes })
            if (state.completeMode === 'failure') callbacks.onFailure(new Error('Password policy internals'))
            else callbacks.onSuccess(state.completeSession)
        }

        getSession(callback) {
            callback(this.sessionError, this.sessionError ? null : this.sessionResult)
        }

        signOut() { state.signOuts += 1 }
    }

    class AuthenticationDetails {
        constructor(data) { this.data = data }
    }

    return { state, sdk: { CognitoUserPool, CognitoUser, AuthenticationDetails } }
}

test('resolves exact role precedence and rejects unknown group values', () => {
    assert.equal(resolveAppRole(['reader']), 'reader')
    assert.equal(resolveAppRole(['reader', 'editor']), 'editor')
    assert.equal(resolveAppRole(['editor', 'admin', 'reader']), 'admin')
    assert.equal(resolveAppRole(['owner', 'Reader']), null)
    assert.equal(resolveAppRole('admin'), null)
    assert.equal(resolveAppRole(null), null)
})

test('validates required access and ID token claims', () => {
    assert.deepEqual(
        sessionClaimsToUser({ sub: 'user-1', 'cognito:groups': ['reader'] }, { email: 'reader@example.test' }),
        { sub: 'user-1', email: 'reader@example.test', role: 'reader' },
    )
    assert.throws(() => sessionClaimsToUser({ 'cognito:groups': ['reader'] }, { email: 'reader@example.test' }), /không hợp lệ/i)
    assert.throws(() => sessionClaimsToUser({ sub: 'user-1', 'cognito:groups': ['reader'] }, {}), /không hợp lệ/i)
    assert.throws(() => sessionClaimsToUser({ sub: 'user-1', 'cognito:groups': [] }, { email: 'reader@example.test' }), /cấp quyền/i)
})

test('creates the SDK boundary with explicit Node storage and signs in successfully', async () => {
    const storage = createStorage()
    const { state, sdk } = createFakeSdk()
    const auth = createCognitoAuth(config, { storage, sdk })

    assert.equal(state.poolData.Storage, storage)
    const result = await auth.signIn('reader@example.test', 'secret-password')

    assert.equal(state.authDetails.data.Username, 'reader@example.test')
    assert.equal(state.authDetails.data.Password, 'secret-password')
    assert.deepEqual(result, {
        kind: 'authenticated',
        session: { user: { sub: 'user-1', email: 'user@example.test', role: 'reader' }, accessToken: 'access-token' },
    })
})

test('maps Cognito authentication failures to a generic safe message', async () => {
    const { state, sdk } = createFakeSdk()
    state.authMode = 'failure'
    const auth = createCognitoAuth(config, { storage: createStorage(), sdk })

    await assert.rejects(auth.signIn('missing@example.test', 'wrong'), (error) => {
        assert.ok(error instanceof Error)
        assert.doesNotMatch(error.message, /UserNotFoundException|private detail/)
        assert.match(error.message, /đăng nhập/i)
        return true
    })
})

test('restores sessions, returns refreshed access tokens, and clears failed sessions', async () => {
    const { state, sdk } = createFakeSdk()
    const auth = createCognitoAuth(config, { storage: createStorage(), sdk })
    const currentUser = new sdk.CognitoUser({ Username: 'reader@example.test', Pool: {} })
    currentUser.sessionResult = session({ token: 'refreshed-token' })
    state.currentUser = currentUser

    assert.equal((await auth.restoreSession())?.accessToken, 'refreshed-token')
    assert.equal(await auth.getAccessToken(), 'refreshed-token')

    currentUser.sessionError = new Error('refresh failed')
    assert.equal(await auth.restoreSession(), null)
    assert.equal(state.signOuts, 1)
})

test('logs out the signed-in user', async () => {
    const { state, sdk } = createFakeSdk()
    const auth = createCognitoAuth(config, { storage: createStorage(), sdk })
    await auth.signIn('reader@example.test', 'secret-password')

    auth.signOut()

    assert.equal(state.signOuts, 1)
})

test('retains a challenged user only until new-password completion', async () => {
    const { state, sdk } = createFakeSdk()
    state.authMode = 'challenge'
    const auth = createCognitoAuth(config, { storage: createStorage(), sdk })

    assert.deepEqual(await auth.signIn('reader@example.test', 'temporary-password'), { kind: 'new-password-required' })
    const challengedUser = state.lastUser
    const completed = await auth.completeNewPassword('new-secret-password')

    assert.equal(completed.accessToken, 'new-password-token')
    assert.equal(state.completions[0].user, challengedUser)
    assert.equal(state.completions[0].password, 'new-secret-password')
    await assert.rejects(auth.completeNewPassword('another-password'), /yêu cầu đặt mật khẩu mới/i)
})
