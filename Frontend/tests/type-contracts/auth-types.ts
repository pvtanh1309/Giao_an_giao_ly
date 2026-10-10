import type { AppRole as AuthAppRole } from '../../lib/auth/types.ts'
import type { AppRole as ContentAppRole } from '../../lib/content-data.ts'

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2) ? true : false

const appRoleCompatibility: Equal<AuthAppRole, ContentAppRole> = true
void appRoleCompatibility
