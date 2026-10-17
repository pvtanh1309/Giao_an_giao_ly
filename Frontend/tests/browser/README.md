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
preserving edits after a failed write; preserving progression content when a row
is deleted; blocking save/logout during image upload; reader access after publication;
and logout once pending work finishes.
Editor checks also cover font-size controls following the current selection,
literal `1. ` headings, default black text, and formatting after save/reload.
The image upload uses a delayed local storage response; persistent S3 media is
covered by the Backend media tests.
