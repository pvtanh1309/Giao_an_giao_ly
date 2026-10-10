import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { loadPublicConfig } from '../lib/config.ts'

const completeEnv = {
    NEXT_PUBLIC_AWS_REGION: ' ap-southeast-1 ',
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: ' ap-southeast-1_example ',
    NEXT_PUBLIC_COGNITO_CLIENT_ID: ' example-client ',
    NEXT_PUBLIC_CONTENT_API_URL: ' https://content.example.test/// ',
    NEXT_PUBLIC_USERS_API_URL: 'http://users.example.test/',
}

test('loads and normalizes complete public config', () => {
    assert.deepEqual(loadPublicConfig(completeEnv), {
        awsRegion: 'ap-southeast-1',
        cognitoUserPoolId: 'ap-southeast-1_example',
        cognitoClientId: 'example-client',
        contentApiUrl: 'https://content.example.test',
        usersApiUrl: 'http://users.example.test',
    })
})

test('reports every missing public config key', () => {
    assert.throws(
        () => loadPublicConfig({ NEXT_PUBLIC_AWS_REGION: '   ' }),
        (error) => {
            assert.ok(error instanceof Error)
            for (const key of Object.keys(completeEnv)) assert.match(error.message, new RegExp(key))
            return true
        },
    )
})

test('rejects non-http API URLs', () => {
    assert.throws(
        () => loadPublicConfig({ ...completeEnv, NEXT_PUBLIC_CONTENT_API_URL: 'ftp://content.example.test' }),
        /NEXT_PUBLIC_CONTENT_API_URL/,
    )
    assert.throws(
        () => loadPublicConfig({ ...completeEnv, NEXT_PUBLIC_USERS_API_URL: 'users.example.test' }),
        /NEXT_PUBLIC_USERS_API_URL/,
    )
})

test('content data re-exports the shared AppRole type', () => {
    const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url))
    const contract = fileURLToPath(new URL('./type-contracts/auth-types.ts', import.meta.url))
    const result = spawnSync(process.execPath, [
        tsc,
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--target', 'ES2022',
        '--module', 'ESNext',
        '--moduleResolution', 'Bundler',
        '--allowImportingTsExtensions',
        contract,
    ], { encoding: 'utf8' })

    assert.equal(result.status, 0, result.stdout + result.stderr)
})
