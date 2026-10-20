> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/plans/personal-profiles-ledger.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Implementation ledger

Spec and plan approved by user. Native execution in existing shared workspace (clean at start); no implementation subagents, push or deployment.

- Task 1: self-profile tests red (missing module), then 10/10 green. Updating legacy tests to new provisioning policy.
- Ruling: archived ACCOUNT_LINK rows remain during retention; uniqueness ignores DELETED accounts, but restore reserves ownership by touching the profile and marking pendingAction=restore in the same transaction. Concurrent create/relink/restore therefore conflict on profile.version.
- Ruling: use the existing workspace to preserve the user's live local development context; no alternate checkout or cloud changes.

- Task 1: complete locally. Reader and Editor provisioning require catechistId; uniqueness/version guards cover create/relink/status/restore. GET /me and PUT /me/profile use authenticated ACCOUNT ownership and preserve login email.
- Task 2: complete locally. Profile provider/menu/modal, contact update and directory synchronization, Reader provisioning UI. Focus trap and portal keep modal in viewport; stale results are owner scoped.
- Task 3: complete locally. Shared Python/TypeScript fixtures cover accented text, emoji, CRLF, breaks, image placeholders, tables and columns. Unicode code-point anchors resolve conservatively.
- Ruling: TypeScript anchor creation/resolution uses asynchronous WebCrypto SHA-256 instead of a synchronous resolver; all callers await it and cancel stale results. Cost if wrong: callers must preserve async cancellation when extended.
- Task 4: complete locally. Private note CRUD, exact-body idempotent UUID retries, 100-note transactional quota, ACCOUNT/META guards, ownership and stale-version tests.
- Task 5: complete locally. Published-only private mode, selection mapping/decorations, detached note listing, plain text dialog, mobile viewport and unsaved work guards.
- Task 6: complete locally. TTL cleanup uses <=25-operation transactions, ACCOUNT absence guards and partial batch retries. Routes match Terraform registry. Both Lambda ZIPs package offline and route imports pass in isolated processes. Deployment guide: Backend/docs/personal-accounts.md.

## Final review and fixes

- Initial review interrupted after two Important findings; remaining review completed in a replacement read-only reviewer session (no implementation delegation).
- Final: fixed dirty note lost on same-document Back — unsaved-history regression RED→GREEN; real Chrome confirms cancelling Back preserves draft/history entry.
- Final: fixed cross-field selection keeping/creating a misleading anchor — selection containment regression RED→GREEN; real Chrome confirms Add is disabled and guidance displayed.
- Final: fixed delayed previous-session 401/token failure signing out current user — auth-session-isolation and SDK regression RED→GREEN; current session/version guards preserve the new user and draft.
- Final: minor (deferred): textarea maxLength counts UTF-16 units while backend counts code points; emoji-heavy notes reach the frontend limit sooner than 8000 code points. No loss of already saved notes.

## Final verification

- Backend full suite: 288/288 pass (`python -m pytest -q`).
- Frontend full suite: 114/114 pass (`npm test`); direct TypeScript `tsc --noEmit` pass; production static build pass.
- Chrome private-profile/note UI: pass for contact/login distinction, Unicode note CRUD/reload, cross-field rejection, Back protection, mobile viewport, two-account privacy.
- Chrome content regression: pass for save/reload/publish, failed-write retention, formatting, optional preparation, progression heading, upload guard and menu logout.
- Terraform dev validate: configuration valid; Python/Terraform route parity tests pass. Whole-repo fmt check finds existing formatting issues (baseline HEAD content-api main.tf also fails); unrelated Terraform files left unchanged.
- No live AWS writes, apply, push, commit or merge performed. Changes remain in the existing workspace as authorized by the plan.
