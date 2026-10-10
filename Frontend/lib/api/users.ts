import type { PublicConfig } from '../config'
import { createApiClient } from './client.ts'
import type { ApiClient } from './client.ts'
import type { AuthorizedApiOptions } from './content'

export function createUsersApi({ config, ...options }: AuthorizedApiOptions): ApiClient {
    return createApiClient({ ...options, baseUrl: config.usersApiUrl })
}
