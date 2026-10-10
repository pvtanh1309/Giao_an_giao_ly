import type { PublicConfig } from '../config'
import { createApiClient } from './client.ts'
import type { ApiClient, ApiClientOptions } from './client.ts'

export type AuthorizedApiOptions = Omit<ApiClientOptions, 'baseUrl'> & { config: PublicConfig }

export function createContentApi({ config, ...options }: AuthorizedApiOptions): ApiClient {
    return createApiClient({ ...options, baseUrl: config.contentApiUrl })
}
