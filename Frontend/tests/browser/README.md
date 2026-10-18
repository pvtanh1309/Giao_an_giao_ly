# Content persistence browser regression

From `Frontend`, run `npm run build` then `npm run test:content-ui`.

Requires Node 22+, local Chrome, and the repo-root Python `.venv` with
`Backend/requirements-dev.txt` installed. Chrome defaults to its standard Windows
installation. Override `CONTENT_TEST_CHROME` or `CONTENT_TEST_PYTHON` for other
installations. `Frontend/.env.local` must match the configuration in the build.

The runner serves `Frontend/out` on a random localhost port and launches a new
headless browser profile. It seeds a synthetic Cognito session and intercepts all
external browser requests. Content API requests go to the real Backend content
services and validators using the offline `MemoryStore` from Backend tests.
Every other external request is blocked. It needs no AWS credentials and does not
test deployed API Gateway, Cognito, DynamoDB, or S3.

Checks cover create/save/reload/publish for lessons, programs and references;
preserving edits after a failed write; keeping progression as a heading;
blocking save/logout during image upload; reader access after publication;
and logout once pending work finishes.

Run `npm run test:personal-ui` for the private profile/note checks. This uses
`personal_backend.py` with real HTTP route/auth/service code and offline fixtures
for two separate Reader accounts. Checks cover contact email versus login email,
emoji offsets, note create/edit/delete and reload, cross-field selection rejection,
unsaved browser Back cancellation, mobile viewport, and isolation between accounts.
All external requests are intercepted; neither runner accesses live AWS.
Editor checks also cover font-size controls following the current selection,
literal `1. `, `- `, `* ` and `+ ` prefixes, default black text, and formatting after save/reload.
Formatting across a soft line break (`Shift+Enter`) must also save and reload
through the Backend validator without rejecting valid inline marks.
Toolbar checks scroll a long document in the lesson dialog and on desktop/mobile,
verify the toolbar stays below the page header or at the dialog scroll boundary,
and verify it leaves the viewport when its editor scrolls away.
The image upload uses a delayed local storage response; persistent S3 media is
covered by the Backend media tests.
