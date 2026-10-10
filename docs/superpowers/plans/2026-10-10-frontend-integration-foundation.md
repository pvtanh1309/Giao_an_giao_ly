# Frontend Integration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend's demo authentication with real Cognito authentication and provide authenticated content/users API clients for later data-integration stages.

**Architecture:** A browser-only Cognito adapter owns SDK calls and localStorage-backed sessions. A React provider exposes the authentication state machine, while a transport-neutral API client injects current access tokens and normalizes backend envelopes and failures. Existing mock business data stays in place during this stage.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, `amazon-cognito-identity-js`, Node test runner, pnpm

**Spec:** `docs/superpowers/specs/2026-10-10-frontend-integration-foundation-design.md`

## Global Constraints

- Terraform remains the sole owner of Cognito User Pool, App Client, groups, API Gateway, Lambda and other AWS resources.
- Store Cognito sessions in browser `localStorage`; never store or log passwords or tokens explicitly.
- Use the access token for API authorization and role/sub claims; use the ID token for email.
- Role precedence is exactly `admin > editor > reader`; a session without one of these groups is not authorized to enter the app.
- Preserve static S3/CloudFront hosting: do not add a Next.js server proxy or HttpOnly-cookie flow.
- Keep all business data mock/in-memory in this stage.
- Tests must not contact AWS.
- Remove `typescript.ignoreBuildErrors`; the final build must perform TypeScript checking.

## Review Focus

- Importing auth/config modules during static build without `window` or `localStorage` must not throw; Task 2 tests lazy browser storage creation.
- Malformed or missing JWT claims must reject the session without granting a role; Task 2 tests absent groups, missing `sub`, and missing email.
- A `NEW_PASSWORD_REQUIRED` challenge must not lose the challenged Cognito user before completion; Task 2 tests sign-in followed by completion.
- A backend `401` with an invalid or empty body must still invalidate the local session exactly once; Task 3 tests the callback and normalized fallback error.
- Double-submit during sign-in/new-password completion must not create parallel auth calls; Task 5 tests disabled submit controls for transitional states.

---

## File Structure

- `Frontend/lib/config.ts`: parse and validate public runtime configuration.
- `Frontend/lib/auth/types.ts`: shared auth roles, users, states and client contract.
- `Frontend/lib/auth/claims.ts`: pure claim-to-user and role mapping.
- `Frontend/lib/auth/cognito.ts`: browser Cognito SDK boundary and challenge lifecycle.
- `Frontend/lib/api/errors.ts`: normalized API error type.
- `Frontend/lib/api/client.ts`: authenticated envelope-aware HTTP transport.
- `Frontend/lib/api/content.ts`: content API client factory.
- `Frontend/lib/api/users.ts`: users API client factory.
- `Frontend/components/auth-provider.tsx`: React auth lifecycle and context.
- `Frontend/components/auth-screen.tsx`: login and required-new-password forms.
- `Frontend/app/providers.tsx`: client-side provider composition.
- `Frontend/app/layout.tsx`: install providers at the app root.
- `Frontend/app/page.tsx`: consume real auth state and remove demo/sessionStorage logic.
- `Frontend/components/site-header.tsx`: consume the auth-owned `AppRole` type.
- `Frontend/.env.example`: document required public configuration placeholders.
- `Frontend/tests/*.test.mjs`: unit and source-level integration coverage using Node's test runner.

### Task 1: Public configuration and authentication domain types

**Files:**
- Create: `Frontend/lib/config.ts`
- Create: `Frontend/lib/auth/types.ts`
- Create: `Frontend/.env.example`
- Create: `Frontend/tests/auth-config.test.mjs`
- Modify: `Frontend/lib/content-data.ts`

**Interfaces:**
- Consumes: `process.env` values named by the spec.
- Produces: `loadPublicConfig(env: Record<string, string | undefined>): PublicConfig`, `getPublicConfig(): PublicConfig`, `AppRole`, `AuthenticatedUser`, `AuthStatus`, `AuthSession`, `AuthResult`, `AuthClient`.

- [ ] **Step 1: Write failing configuration and type-boundary tests**

Add tests named `loads and normalizes complete public config`, `reports every missing public config key`, and `rejects non-http API URLs`. Assert both API URLs lose trailing slashes, missing keys appear in one error, and only `http:`/`https:` API URLs are accepted. Add a source assertion that `AppRole` is imported/re-exported from `lib/auth/types.ts` instead of declared independently in `content-data.ts`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd Frontend; node --test tests/auth-config.test.mjs`

Expected: FAIL because `lib/config.ts` and `lib/auth/types.ts` do not exist.

- [ ] **Step 3: Implement config parsing, exact auth types and environment example**

Implement:

```ts
type PublicConfig = {
  awsRegion: string
  cognitoUserPoolId: string
  cognitoClientId: string
  contentApiUrl: string
  usersApiUrl: string
}

loadPublicConfig(env: Record<string, string | undefined>): PublicConfig
getPublicConfig(): PublicConfig
```

Define `AppRole`, `AuthenticatedUser`, `AuthStatus`, `AuthSession`, the authenticated/new-password-required `AuthResult` union, and the `AuthClient` methods required by the spec. Re-export `AppRole` from `content-data.ts` temporarily so existing consumers remain compatible. Add the five placeholder variables to `.env.example`.

Use these exact domain contracts:

```ts
type AppRole = 'reader' | 'editor' | 'admin'
type AuthStatus = 'loading' | 'anonymous' | 'authenticating' | 'new-password-required' | 'authenticated'
type AuthenticatedUser = { sub: string; email: string; role: AppRole }
type AuthSession = { user: AuthenticatedUser; accessToken: string }
type AuthResult =
  | { kind: 'authenticated'; session: AuthSession }
  | { kind: 'new-password-required' }
interface AuthClient {
  signIn(email: string, password: string): Promise<AuthResult>
  completeNewPassword(newPassword: string): Promise<AuthSession>
  restoreSession(): Promise<AuthSession | null>
  getAccessToken(): Promise<string>
  signOut(): void
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd Frontend; node --test tests/auth-config.test.mjs`

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit Task 1**

```powershell
git add Frontend/lib/config.ts Frontend/lib/auth/types.ts Frontend/lib/content-data.ts Frontend/.env.example Frontend/tests/auth-config.test.mjs
git commit -m "feat(frontend): define integration config and auth types"
```

### Task 2: Cognito SDK boundary and session claim validation

**Files:**
- Create: `Frontend/lib/auth/claims.ts`
- Create: `Frontend/lib/auth/cognito.ts`
- Create: `Frontend/tests/auth-cognito.test.mjs`
- Modify: `Frontend/package.json`
- Modify: `Frontend/pnpm-lock.yaml`

**Interfaces:**
- Consumes: `PublicConfig`, auth domain types from Task 1, and browser `Storage`.
- Produces: `resolveAppRole(groups: unknown): AppRole | null`, `sessionClaimsToUser(accessPayload: unknown, idPayload: unknown): AuthenticatedUser`, `createCognitoAuth(config: PublicConfig, options?: { storage?: Storage; sdk?: CognitoSdkPort }): AuthClient`.

- [ ] **Step 1: Install the approved Cognito SDK**

Run: `cd Frontend; pnpm add amazon-cognito-identity-js`

Expected: exit 0; `package.json` and `pnpm-lock.yaml` include `amazon-cognito-identity-js`.

- [ ] **Step 2: Write failing claim and Cognito lifecycle tests**

Add tests for exact role precedence, non-array/unknown groups, missing `sub`, missing email, successful sign-in, wrong credentials mapped to a generic safe message, session restore, refresh failure returning no session, logout, and `NEW_PASSWORD_REQUIRED` followed by `completeNewPassword`. Inject a fake `CognitoSdkPort`; assert no constructor accesses `window` until `createCognitoAuth` is called and an explicit fake storage works in Node.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `cd Frontend; node --test tests/auth-cognito.test.mjs`

Expected: FAIL because the claims and Cognito adapter modules do not exist.

- [ ] **Step 4: Implement claim validation and the Cognito adapter**

Implement the produced interfaces. The adapter must keep the challenged Cognito user only inside its closure until `completeNewPassword`, clear that reference after success/failure/logout, use `AuthenticationDetails`, and let the SDK persist its session via the supplied storage or browser `localStorage`. Map authentication failures to safe Vietnamese messages without exposing SDK exception details.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `cd Frontend; node --test tests/auth-cognito.test.mjs`

Expected: PASS with 0 failures.

- [ ] **Step 6: Commit Task 2**

```powershell
git add Frontend/package.json Frontend/pnpm-lock.yaml Frontend/lib/auth/claims.ts Frontend/lib/auth/cognito.ts Frontend/tests/auth-cognito.test.mjs
git commit -m "feat(frontend): add Cognito authentication boundary"
```

### Task 3: Authenticated API transport and service boundaries

**Files:**
- Create: `Frontend/lib/api/errors.ts`
- Create: `Frontend/lib/api/client.ts`
- Create: `Frontend/lib/api/content.ts`
- Create: `Frontend/lib/api/users.ts`
- Create: `Frontend/tests/api-client.test.mjs`

**Interfaces:**
- Consumes: `getAccessToken(): Promise<string>`, `onUnauthorized(): void`, the two normalized URLs from `PublicConfig`.
- Produces: `ApiError`, `createApiClient(options: ApiClientOptions): ApiClient`, `createContentApi(options: AuthorizedApiOptions): ApiClient`, `createUsersApi(options: AuthorizedApiOptions): ApiClient`, and `request<T>(path: string, init?: ApiRequestInit): Promise<T>`.

- [ ] **Step 1: Write failing transport tests**

Test GET without body/content-type, JSON body serialization, Bearer token injection, `{ data, meta }` parsing, `204`, backend error details/requestId preservation, network errors, invalid JSON/envelopes, `403`, `409`, and a `401` with empty/malformed body. Assert `onUnauthorized` runs exactly once for `401` and never for `403`/`409`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd Frontend; node --test tests/api-client.test.mjs`

Expected: FAIL because `lib/api/client.ts` and `lib/api/errors.ts` do not exist.

- [ ] **Step 3: Implement errors and generic API client**

Define `ApiError` with `code`, `status`, `details`, `requestId`, and safe `message`. Implement the produced client interfaces with injected `fetchImpl`, avoiding `Content-Type` on bodyless requests and invoking unauthorized cleanup before throwing the normalized error.

Use these exact transport contracts:

```ts
type ApiRequestInit = Omit<RequestInit, 'body'> & { body?: unknown }
type ApiClientOptions = {
  baseUrl: string
  getAccessToken: () => Promise<string>
  onUnauthorized: () => void
  fetchImpl?: typeof fetch
}
type ApiClient = { request<T>(path: string, init?: ApiRequestInit): Promise<T> }
type AuthorizedApiOptions = Omit<ApiClientOptions, 'baseUrl'> & { config: PublicConfig }
```

- [ ] **Step 4: Implement content/users client factories**

Each factory selects only its matching normalized base URL and delegates to `createApiClient`; do not add unused domain DTOs or endpoint methods in this stage.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `cd Frontend; node --test tests/api-client.test.mjs`

Expected: PASS with 0 failures.

- [ ] **Step 6: Commit Task 3**

```powershell
git add Frontend/lib/api Frontend/tests/api-client.test.mjs
git commit -m "feat(frontend): add authenticated API clients"
```

### Task 4: React authentication provider

**Files:**
- Create: `Frontend/components/auth-provider.tsx`
- Create: `Frontend/lib/auth/state.ts`
- Create: `Frontend/tests/auth-provider.test.mjs`

**Interfaces:**
- Consumes: `AuthClient` from Task 1 and `createCognitoAuth` from Task 2.
- Produces: `AuthProvider`, `useAuth(): AuthContextValue`, pure `authReducer(state: AuthState, action: AuthAction): AuthState`, and context methods `login`, `completeNewPassword`, `logout`, `getAccessToken`.

`AuthContextValue` is exactly:

```ts
type AuthContextValue = {
  status: AuthStatus
  user: AuthenticatedUser | null
  error: string | null
  login(email: string, password: string): Promise<void>
  completeNewPassword(newPassword: string): Promise<void>
  logout(): void
  getAccessToken(): Promise<string>
}
```

- [ ] **Step 1: Write failing state-machine and provider-contract tests**

Test every transition in the approved state machine, including restore success/failure, login failure, challenge, challenge completion, logout, and unauthorized invalidation. Add source-level assertions that provider restoration occurs in an effect, context exposes all five methods/values, and errors never contain passwords/tokens.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd Frontend; node --test tests/auth-provider.test.mjs`

Expected: FAIL because the provider and reducer do not exist.

- [ ] **Step 3: Implement the pure reducer**

Use the exact `AuthStatus` values from Task 1. Invalid/failing restoration ends at `anonymous`; a challenge ends at `new-password-required`; successful session operations end at `authenticated` with a user.

- [ ] **Step 4: Implement provider lifecycle and context**

Allow an optional `client` prop for deterministic tests and default to a lazily created browser Cognito client from public config. Catch config errors into an anonymous/error state. `getAccessToken` delegates to the client; logout clears Cognito state. Export an unauthorized handler that clients can call without circular imports.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `cd Frontend; node --test tests/auth-provider.test.mjs`

Expected: PASS with 0 failures.

- [ ] **Step 6: Commit Task 4**

```powershell
git add Frontend/components/auth-provider.tsx Frontend/lib/auth/state.ts Frontend/tests/auth-provider.test.mjs
git commit -m "feat(frontend): provide application auth state"
```

### Task 5: Replace demo login with Cognito-backed UI and enforce checked builds

**Files:**
- Create: `Frontend/components/auth-screen.tsx`
- Create: `Frontend/app/providers.tsx`
- Create: `Frontend/tests/auth-ui-integration.test.mjs`
- Modify: `Frontend/app/layout.tsx`
- Modify: `Frontend/app/page.tsx`
- Modify: `Frontend/components/site-header.tsx`
- Modify: `Frontend/next.config.mjs`
- Modify: `Frontend/app/styles/auth.css` only if the new-password form needs an existing-style extension

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth`, and `AppRole` from Tasks 1–4.
- Produces: application root wired to Cognito auth; no demo credential/role/sessionStorage path remains.

- [ ] **Step 1: Write failing UI integration tests**

Assert source and behavior contracts: root layout installs `Providers`; page consumes `useAuth`; no `giao-ly-user`, demo credentials, role-setting login, or `sessionStorage` remains; login and new-password forms clear password state in `finally`; transitional states disable submit to prevent double calls; loading renders a neutral loading surface; logout delegates to context; `site-header.tsx` imports `AppRole` from auth types; `next.config.mjs` no longer contains `ignoreBuildErrors`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd Frontend; node --test tests/auth-ui-integration.test.mjs`

Expected: FAIL against the current demo login and unchecked build configuration.

- [ ] **Step 3: Implement provider composition and auth screen**

`app/providers.tsx` is a client component wrapping children in `AuthProvider`. `AuthScreen` owns email/current-password/new-password/confirmation fields, calls the matching context method, clears all password fields in `finally`, uses generic safe errors, and disables submit during `authenticating`.

- [ ] **Step 4: Replace authentication logic in the application page**

Remove local auth role/readiness/password/error state and demo account markup. Use `status`, `user`, and `logout` from `useAuth`; render loading, auth screen, or application content accordingly. Derive `currentUser` only as `user.role` after authentication. Do not change mock business-data behavior.

- [ ] **Step 5: Install root provider and enable TypeScript build checks**

Wrap layout children in `Providers`, update the header type import, and remove the `typescript.ignoreBuildErrors` block from `next.config.mjs`.

- [ ] **Step 6: Run focused and full frontend tests**

Run: `cd Frontend; node --test tests/auth-ui-integration.test.mjs`

Expected: PASS with 0 failures.

Run: `cd Frontend; node --test tests/*.test.mjs`

Expected: all frontend tests PASS with 0 failures.

- [ ] **Step 7: Run the production build**

Run: `cd Frontend; pnpm build`

Expected: exit 0 with TypeScript checking enabled and static-compatible pages generated.

- [ ] **Step 8: Verify secret/session hygiene**

Run: `rg -n "giao-ly-user|user@gmail\.com|editor@gmail\.com|admin@gmail\.com|sessionStorage|console\.(log|debug).*token|console\.(log|debug).*password" Frontend/app Frontend/components Frontend/lib`

Expected: no matches.

- [ ] **Step 9: Commit Task 5**

```powershell
git add Frontend/app Frontend/components Frontend/lib Frontend/next.config.mjs Frontend/tests/auth-ui-integration.test.mjs
git commit -m "feat(frontend): use Cognito authentication in the app"
```

## Final Verification

Run from `Frontend`:

```powershell
node --test tests/*.test.mjs
pnpm build
```

Expected: all tests pass, build exits 0, and no real AWS credentials are required. Live Cognito sign-in remains an AWS dev acceptance check because this plan deliberately uses fakes for automated tests.
