# Users API
Python 3.12 Lambda `users_api.handler.lambda_handler`, HTTP API payload v2, and the 14 directory/account routes in [API contract](../../../Backend/docs/api-contract-v1.md). All routes require Cognito JWT plus `aws.cognito.signin.user.admin` access-token scope. Lambda checks current ACCOUNT status, then requires admin for account operations and editor/admin for profile writes.

Environment: `TABLE_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`. ZIP must contain `users_api/`, `shared/` and dependencies at its root.
IAM grants required table/GSI1 operations and the explicitly listed Cognito admin actions on this environment's pool. No S3 access.

The same Lambda consumes REMOVE events whose old PK starts `ACCOUNT#`; profile deletions never directly trigger Cognito deletion. Partial failures, bounded retries/bisection, encrypted SQS failure destination and alarms match content-api. SQS stream failure messages retain shard/sequence metadata rather than removed item contents; investigate before the stream's 24-hour retention expires.

Optional existing regional ACM certificate/domain/Route53 zone enable custom DNS. Outputs include endpoint, Lambda identifiers and failure queue URL.
