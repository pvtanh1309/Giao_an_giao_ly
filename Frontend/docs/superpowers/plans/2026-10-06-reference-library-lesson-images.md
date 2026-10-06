# Reference Library and Lesson Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fixed Sinh hoạt/Kỹ năng reference library and let editors insert compact, zoomable images into lesson rich text.

**Architecture:** Keep the library and its draft/published content in the existing content domain and model rich text as TipTap JSON. The browser obtains short-lived upload/download URLs through the existing content API and transfers image bytes directly to a private S3 bucket; DynamoDB stores JSON and media references only. This plan includes frontend work and backend design-document updates, but not Lambda, Terraform, Cognito implementation, or AWS deployment.

**Tech Stack:** Next.js 16 static-capable App Router, React 19, TypeScript, TipTap 3, lucide-react, Node `node:test`, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-06-reference-library-lesson-images-design.md`

## Global Constraints

- The reference categories are fixed: `Sinh hoạt` and `Kỹ năng`.
- TipTap JSON is the canonical rich-text format; never persist signed media URLs, base64, or image bytes in a lesson document.
- Accept JPEG, PNG, and WebP only; reject SVG and files larger than 5 MiB (5 × 1024 × 1024 bytes); optimize toward a 1600 px maximum long edge.
- Default image width is 220 px; size choices are approximately 140/220/320 px and rendered width never exceeds its content area.
- Use the existing `content-api` Gateway/Lambda and `GiaoLyTable`; add no Lambda, API Gateway, or DynamoDB table.
- Keep S3 private; only content API may authorize media references and issue signed URLs.
- Do not write Lambda or Terraform code in this work; the user intends to author those personally.

## Review Focus

- Client-supplied `src` must never become persistent content: test serialization strips runtime URLs and preserves `mediaId`, `alt`, `width`, and `alignment`.
- Invalid MIME and files over 5 MB must be rejected before insertion/upload; test supported and rejected formats and the size boundary.
- Upload failure or missing API configuration must leave no broken image node and show a recoverable editor error.
- Signed image URLs are runtime-only and can expire: test the client boundary requests a fresh read response instead of persisting/assuming a permanent URL.
- Readers must not be shown drafts, including via category counts/search results; test the reference filter for reader and manager roles.

---

### Task 1: Align the backend design documents with the approved contract

**Files:**
- Modify (outside Frontend Git repository): `../Backend/docs/api-contract-v1.md`
- Modify (outside Frontend Git repository): `../Backend/docs/backend-database-design.md`

**Interfaces:**
- Consumes: the approved feature spec.
- Produces: a source-of-truth API/schema description the user's Python/Terraform implementation can follow.

- [ ] **Step 1: Update the API contract**

Document fixed reference categories, list/detail/manage routes, draft/publish/delete/restore semantics, TipTap document fields for lessons/references, media upload URL request/response, signed image URL behavior, and the 5 MiB/MIME constraints. Replace misleading `contentHtml` naming for rich text with the agreed TipTap JSON contract; keep plain-text fields as strings. The manager list includes DELETED references during their 10-day retention with `status=DELETED`; reader list/detail routes never return them.

- [ ] **Step 2: Update the database/infrastructure design**

Add `REFERENCE#<id>` META/DRAFT/PUBLISHED items and category/title catalog access; add MEDIA metadata items in `GiaoLyTable`, TTL states (one day unattached upload, ten days orphan/soft-delete), private S3 image bucket, least-privilege content Lambda permissions, CORS, `NEW_AND_OLD_IMAGES`, and the existing content Lambda stream mapping for media cleanup. Explicitly retain the existing users Lambda stream responsibility; do not add another Lambda.

- [ ] **Step 3: Review docs for contract consistency**

Review the two changed files directly and verify no contradictory `contentHtml`/TipTap field names remain in the active contract; routes, field names, limits, role rules, and TTL/stream lifecycle agree with the approved spec. Backend is not currently inside a Git repository, so do not stage/commit these files from Frontend.

### Task 2: Define reference content types and filtering behavior

**Files:**
- Modify: `lib/content-data.ts`
- Create: `lib/reference-content.ts`
- Create: `tests/reference-content.test.mjs`

**Interfaces:**
- Consumes: existing `Lesson`, `IndustryColor`, and TipTap JSON conventions.
- Produces: `ReferenceCategory = 'Sinh hoạt' | 'Kỹ năng'`; `ReferenceDocument` with `id`, `title`, `category`, `status: 'ACTIVE' | 'DELETED'`, optional `draft` and `published` revisions (`content: string`, `version: number`); `ReferenceListItem` with metadata only (`id`, `title`, `category`, `status`, `hasDraft`, `hasPublished`); and `filterReferences(references, category, query, canManage, includeDeleted)` returning only metadata appropriate to the caller.

- [ ] **Step 1: Write failing tests**

Test exact-category filtering and Vietnamese case-insensitive title search; reader results include only non-deleted items with a published revision and never include draft content; manager results include active DRAFT-only/PUBLISHED-with-DRAFT metadata; `includeDeleted` only reveals DELETED metadata to managers; test empty-query behavior.

- [ ] **Step 2: Run tests and verify expected failure**

Run: `node --experimental-strip-types --test tests/reference-content.test.mjs`

Expected: FAIL because `reference-content.ts` and the reference model do not yet exist.

- [ ] **Step 3: Implement the reference model and filter**

Implement the exported types and `filterReferences` in the files listed above. Keep the filter pure and leave lesson filtering unchanged.

- [ ] **Step 4: Run the focused test**

Run: `node --experimental-strip-types --test tests/reference-content.test.mjs`

Expected: all reference filter tests PASS.

- [ ] **Step 5: Commit the model and tests**

```powershell
git add -- lib/content-data.ts lib/reference-content.ts tests/reference-content.test.mjs
git commit -m "feat: model reference library content"
```

### Task 3: Add the reference library and reading/editing flow

**Files:**
- Create: `components/reference-directory.tsx`
- Create: `components/reference-reading-page.tsx`
- Modify: `components/lesson-directory.tsx`
- Modify: `app/page.tsx`
- Modify: `app/styles/content.css`
- Create: `app/styles/reference-reading.css`
- Modify: `app/globals.css`
- Create: `tests/reference-library-ui.test.mjs`

**Interfaces:**
- Consumes: `ReferenceDocument`, `ReferenceCategory`, and `filterReferences` from Task 2; existing `LessonRichTextEditor` for editing/viewing reference text.
- Produces: a separate library card beside the five industries; category selection; title search; detail URL using static-compatible `referenceId` and `referenceCategory` query parameters; manager controls for create/edit/draft/publish/delete/restore; reader-only published view.

- [ ] **Step 1: Write failing UI contract tests**

Assert that the lesson directory keeps the five industry cards and adds a distinct reference card, exposes the two fixed category names, and that reference details expose manager actions only when `canManage` is true.

- [ ] **Step 2: Run tests and verify expected failure**

Run: `node --experimental-strip-types --test tests/reference-library-ui.test.mjs`

Expected: FAIL because the new reference components/routes do not exist.

- [ ] **Step 3: Implement the category/list component**

Create `ReferenceDirectory` with category filters, title search, empty state, and a clear back action. Do not add category CRUD.

- [ ] **Step 4: Implement the reference reading/editing page**

Create `ReferenceReadingPage` using the existing rich-text editor in view/edit mode, title/category editing, save/cancel, draft/publish, and delete/restore controls as appropriate to status. Reuse existing role checks and toast patterns.

- [ ] **Step 5: Wire static-compatible navigation and state in `app/page.tsx`**

Read/write `referenceId` and `referenceCategory` query parameters; preserve browser back behavior. Keep references in a separate state collection so they never appear among lessons for the five industries. The current frontend remains mock/in-memory until the user's backend is implemented.

- [ ] **Step 6: Add responsive presentation and verify**

Run: `node --experimental-strip-types --test tests/reference-content.test.mjs tests/reference-library-ui.test.mjs`

Expected: all reference model/UI contract tests PASS; at mobile width the list and detail do not require horizontal scrolling.

- [ ] **Step 7: Commit reference UI**

```powershell
git add -- components/reference-directory.tsx components/reference-reading-page.tsx components/lesson-directory.tsx app/page.tsx app/styles/content.css app/styles/reference-reading.css app/globals.css tests/reference-library-ui.test.mjs
git commit -m "feat: add reference material library"
```

### Task 4: Add safe image insertion and upload client for lesson editors

**Files:**
- Create: `lib/lesson-media.ts`
- Create: `tests/lesson-media.test.mjs`
- Modify: `components/rich-text-extensions.ts`
- Modify: `components/rich-text-toolbar.tsx`
- Modify: `components/lesson-rich-text-editor.tsx`
- Modify: `components/lesson-editor-fields.tsx`
- Modify: `components/lesson-reading-page.tsx`
- Modify: `components/admin-editor-dialog.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `app/styles/rich-text.css`

**Interfaces:**
- Consumes: approved upload route and node shape from Task 1; lesson ID and `getAccessToken(): Promise<string>` provider supplied by the application.
- Produces: `validateLessonImage(file: File): { ok: true } | { ok: false; reason: string }`, `stripRuntimeImageUrls(document: JSONContent): JSONContent`, and `uploadLessonImage({ lessonId, file, apiBaseUrl, getAccessToken, fetchImpl }): Promise<{ mediaId: string; previewSrc: string }>`; the returned object URL is preview-only. A custom TipTap image node carries stable `mediaId`, `alt`, `width`, `alignment`, and runtime-only `src`.

- [ ] **Step 1: Write failing media utility tests**

Test JPEG/PNG/WebP acceptance; SVG/GIF/unknown MIME rejection; exactly-5-MB acceptance and over-5-MB rejection; preservation of the stable media attributes while stripping `src` from serialized document JSON.

- [ ] **Step 2: Run tests and verify expected failure**

Run: `node --experimental-strip-types --test tests/lesson-media.test.mjs`

Expected: FAIL because the validation and serialization helpers do not exist.

- [ ] **Step 3: Implement the media validation and canonical document helpers**

Implement only the test-defined behavior in `lib/lesson-media.ts`; do not store data URLs or signed URLs in lesson state.

- [ ] **Step 4: Run the focused test**

Run: `node --experimental-strip-types --test tests/lesson-media.test.mjs`

Expected: all media utility tests PASS.

- [ ] **Step 5: Add the TipTap image node and toolbar control**

Run `pnpm add @tiptap/extension-image@3.31.4`, extend its attributes with stable media metadata, and add “Chèn ảnh” file-picker control. Reject unsupported files before mutating editor content; show upload progress/error; insert only after upload succeeds.

- [ ] **Step 6: Add the signed-upload client and connect lesson editors**

POST file MIME/size to `/manage/lessons/{lessonId}/media-upload-url` with a Cognito access token from the injected `getAccessToken(): Promise<string>` provider, then PUT bytes to the returned URL with its required headers. Pass lesson ID and token provider to all lesson rich-text fields (create form and direct edit); do not enable image insertion in program schedules or reference documents. If the current mock-auth app has no token provider configured, show an explanatory recoverable message; never treat its mock role as a token.

- [ ] **Step 7: Verify the editor upload contract with a test fetch adapter**

Test that the client sends the lesson ID, MIME and byte size to the signing endpoint, uploads only to the returned URL, inserts the returned `mediaId`, and leaves the document unchanged on signing/PUT failure. Use a test `fetch` adapter; no real AWS request.

- [ ] **Step 8: Run focused and existing editor tests**

Run: `node --experimental-strip-types --test tests/lesson-media.test.mjs tests/lesson-content.test.mjs`

Expected: all media/editor tests PASS.

- [ ] **Step 9: Commit image editor integration**

```powershell
git add -- lib/lesson-media.ts tests/lesson-media.test.mjs components/rich-text-extensions.ts components/rich-text-toolbar.tsx components/lesson-rich-text-editor.tsx components/lesson-editor-fields.tsx components/lesson-reading-page.tsx components/admin-editor-dialog.tsx app/styles/rich-text.css package.json pnpm-lock.yaml
git commit -m "feat: insert lesson images through private media API"
```

### Task 5: Add responsive image viewing and zoom

**Files:**
- Create: `components/lesson-image-lightbox.tsx`
- Modify: `components/rich-text-extensions.ts`
- Modify: `components/lesson-rich-text-editor.tsx`
- Modify: `app/styles/rich-text.css`
- Create: `tests/lesson-image-view.test.mjs`

**Interfaces:**
- Consumes: image node attributes and runtime signed `src` from Task 4.
- Produces: inline responsive image display and an accessible lightbox that opens from pointer/touch and closes through its button, Escape, or keyboard activation.

- [ ] **Step 1: Write failing image-view tests**

Assert default width 220 px, size bounds/viewport responsiveness, accessible image alt, open action, Escape close, and close button behavior.

- [ ] **Step 2: Run tests and verify expected failure**

Run: `node --experimental-strip-types --test tests/lesson-image-view.test.mjs`

Expected: FAIL because the lightbox/view behavior does not exist.

- [ ] **Step 3: Implement accessible image zoom**

Implement a lightbox that keeps the image within the viewport, provides a labelled close button, supports Escape and keyboard focus, and returns focus to the image trigger when closed.

- [ ] **Step 4: Run image-view tests and commit**

Run: `node --experimental-strip-types --test tests/lesson-image-view.test.mjs`

Expected: all image-view tests PASS.

```powershell
git add -- components/lesson-image-lightbox.tsx components/rich-text-extensions.ts components/lesson-rich-text-editor.tsx app/styles/rich-text.css tests/lesson-image-view.test.mjs
git commit -m "feat: add zoomable lesson images"
```

### Task 6: Verify the integrated static frontend

**Files:**
- Verify all files from Tasks 1–5; no additional feature files.

- [ ] **Step 1: Run the complete existing and new Node test suite**

Run: `node --experimental-strip-types --test tests/*.test.mjs`

Expected: all tests PASS, including lesson content, reference filtering, upload validation, serialization and image zoom.

- [ ] **Step 2: Run TypeScript and production build**

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `pnpm build`

Expected: Next.js production build succeeds and retains the static-compatible query-based pages.

- [ ] **Step 3: Check patch whitespace and review feature scope**

Run: `git diff --check`

Expected: no whitespace errors; no Lambda/Terraform code, public S3 ACL, third API Gateway, or third DynamoDB table was added.

## Backend/production handoff

The frontend image upload requires a deployed implementation of the approved content API routes and a Cognito access-token provider. The current app uses mock session role state and has no token provider, so Task 4 defines an injected `getAccessToken(): Promise<string>` contract; live upload remains gated until Cognito login exists. Until the user writes/deploys those parts, automated tests use a mocked HTTP adapter and real S3 upload cannot be declared end-to-end complete. Before production, the user's backend must test: reader cannot fetch a DRAFT image; an editor cannot bind another lesson's media ID; upload validates actual `HeadObject` content type/size; publish only exposes referenced images; and TTL stream cleanup is idempotent.
