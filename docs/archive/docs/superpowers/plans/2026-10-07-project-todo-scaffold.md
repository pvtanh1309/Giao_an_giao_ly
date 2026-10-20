> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: docs/superpowers/plans/2026-10-07-project-todo-scaffold.md. Ngu?n hi?n h?nh: [CONTEXT](../../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# Project TODO Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a navigable, non-deploying scaffold for the agreed Terraform, Python backend, and frontend integration work.

**Architecture:** Shared Terraform modules hold future AWS resources; environment roots supply dev/prod values and keep separate state. Python packages separate HTTP entry points, shared contracts, services, and AWS repositories. A root index links each feature to its owner and API contract.

**Tech Stack:** Terraform AWS provider, Python 3.12, pytest, existing Next.js frontend.

**Spec:** `docs/superpowers/specs/2026-10-07-project-todo-scaffold-design.md`

## Global Constraints

- Preserve `infrastructure/bootstrap/`, existing state, and bootstrap/dev/prod S3 backend keys. Never run `terraform apply`.
- Preserve existing `infrastructure/modules/identity/main.tf` and all frontend behavior.
- Keep incomplete Terraform modules non-deploying: comments and documentation only, with no dummy resources or fake outputs.
- Use `ap-southeast-1`; dev/prod names come from each environment root, not hardcoded in shared modules.
- Use `Backend/docs/api-contract-v1.md` as the current API contract; ignore the database design's explicitly historical route section.
- Do not add credentials, passwords, JWTs, user data, or state to source files.

## Review Focus

- An incomplete Terraform module must not create application resources during `plan`; check both root modules contain no active calls to unfinished modules.
- Each documented dev/prod backend key must remain distinct from the bootstrap key; compare the three files.
- A user opening any entry in `TODO-INDEX.md` must find an existing file and a matching `TODO` marker; verify every link.
- Python skeleton imports must resolve without AWS access; compile packages and run offline tests.
- Frontend mock behavior must remain unchanged; inspect the change list and run existing frontend tests if available.

---

### Task 1: Terraform module scaffold

**Files:**
- Preserve: `infrastructure/bootstrap/**`, `infrastructure/modules/identity/main.tf`
- Create or complete: `infrastructure/modules/{identity,database,app-hosting,content-api,user-api}/{README.md,variables.tf,outputs.tf}`
- Create or complete where absent: `infrastructure/modules/{database,app-hosting,content-api,user-api}/main.tf`
- Modify: `infrastructure/environments/{dev,prod}/main.tf`

**Interfaces:**
- Consumes: the existing S3 backend files and API architecture in the spec.
- Produces: exact module input/output TODO lists and commented root call sites; no new deployable resource.

- [ ] **Step 1:** Inventory current module files and copy the five module names into a path checklist.
- [ ] **Step 2:** Add each module's README with its resource inventory, inputs, outputs, and a numbered `TODO` list; mark inputs/outputs as documentation where implementation is absent.
- [ ] **Step 3:** Add only safe comments to empty `.tf` files; document commented call sites in dev/prod root `main.tf` and pass environment names conceptually through `var.environment`.
- [ ] **Step 4:** Run `terraform fmt -check -recursive infrastructure` if Terraform is available; inspect root files to confirm no active calls to incomplete modules and compare three backend keys.

### Task 2: Python backend scaffold

**Files:**
- Create: `Backend/content_api/{__init__.py,handler.py,routes.py}`
- Create: `Backend/users_api/{__init__.py,handler.py,routes.py}`
- Create: `Backend/shared/{__init__.py,responses.py,errors.py,auth.py}`
- Create: `Backend/content_api/{services,repositories}/__init__.py`, `Backend/users_api/{services,repositories}/__init__.py`
- Create: `Backend/tests/{unit,integration}/README.md`, `Backend/README.md`

**Interfaces:**
- Consumes: HTTP API payload v2 and the route/role matrix in `Backend/docs/api-contract-v1.md`.
- Produces: named handler entry points, route ownership lists, shared response/auth contracts, and safe unimplemented hooks. No fake successful result or AWS calls.

- [ ] **Step 1:** Enumerate current contract routes by content/users API, with role requirements; verify no route from the current contract is omitted.
- [ ] **Step 2:** Create package boundaries and handler/route TODO markers with exact payload v2 entry-point signatures; any invoked unimplemented action raises `NotImplementedError`.
- [ ] **Step 3:** Add shared response/error/auth interfaces, repository/service ownership notes, and test directory guidance without implementing business logic.
- [ ] **Step 4:** Run `python -m compileall Backend/content_api Backend/users_api Backend/shared` if Python is available; inspect for credentials and accidental success stubs.

### Task 3: Frontend integration map and project index

**Files:**
- Create: `Frontend/docs/backend-integration-map.md`
- Create: `TODO-INDEX.md`
- Preserve: all other `Frontend/**` files.

**Interfaces:**
- Consumes: module READMEs and Python route ownership from Tasks 1–2.
- Produces: one root entry point to every agreed capability and a frontend adapter map; no runtime frontend change.

- [ ] **Step 1:** Document Cognito token acquisition, content/users API clients, TipTap and schedule DTO adapters, media ID/URL handling, and relevant existing frontend owners.
- [ ] **Step 2:** Write `TODO-INDEX.md` in the approved implementation order, linking each capability to an existing file and contract section.
- [ ] **Step 3:** Verify every local Markdown link resolves and each target contains the advertised TODO or ownership note; review the change list for unintended frontend edits.
- [ ] **Step 4:** Run existing offline frontend tests only if no new dependencies or network access are required; report skipped checks rather than claiming success.

## Completion

Perform one final inventory of created files, compile/format checks, and backend configuration file comparison without reading state. Report scaffold locations, intentionally incomplete areas, test results, and that no AWS `apply` occurred. The root Git repository was created after planning; preserve existing user changes and hand off this scaffold uncommitted.
