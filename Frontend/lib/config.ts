export type PublicConfig = {
    awsRegion: string
    cognitoUserPoolId: string
    cognitoClientId: string
    contentApiUrl: string
    usersApiUrl: string
}

const configKeys = {
    awsRegion: 'NEXT_PUBLIC_AWS_REGION',
    cognitoUserPoolId: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
    cognitoClientId: 'NEXT_PUBLIC_COGNITO_CLIENT_ID',
    contentApiUrl: 'NEXT_PUBLIC_CONTENT_API_URL',
    usersApiUrl: 'NEXT_PUBLIC_USERS_API_URL',
} as const

type PublicConfigKey = keyof typeof configKeys

function normalizeApiUrl(value: string, environmentKey: string): string {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        throw new Error(`${environmentKey} phải là URL HTTP hợp lệ.`)
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`${environmentKey} chỉ chấp nhận giao thức http hoặc https.`)
    }

    return value.replace(/\/+$/, '')
}

export function loadPublicConfig(env: Record<string, string | undefined>): PublicConfig {
    const values = {} as Record<PublicConfigKey, string>
    const missingKeys: string[] = []

    for (const [property, environmentKey] of Object.entries(configKeys) as [PublicConfigKey, string][]) {
        const value = env[environmentKey]?.trim()
        if (!value) missingKeys.push(environmentKey)
        else values[property] = value
    }

    if (missingKeys.length > 0) {
        throw new Error(`Thiếu cấu hình public bắt buộc: ${missingKeys.join(', ')}`)
    }

    return {
        awsRegion: values.awsRegion,
        cognitoUserPoolId: values.cognitoUserPoolId,
        cognitoClientId: values.cognitoClientId,
        contentApiUrl: normalizeApiUrl(values.contentApiUrl, configKeys.contentApiUrl),
        usersApiUrl: normalizeApiUrl(values.usersApiUrl, configKeys.usersApiUrl),
    }
}

export function getPublicConfig(): PublicConfig {
    return loadPublicConfig(process.env)
}
