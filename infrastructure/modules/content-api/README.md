# Content API
Python 3.12 Lambda `content_api.handler.lambda_handler`, HTTP API payload v2, and the 28 content routes in [API contract](../../../Backend/docs/api-contract-v1.md). All routes use Cognito JWT authentication and the `aws.cognito.signin.user.admin` access-token scope; Lambda enforces reader/editor/admin permissions and strongly checks current ACCOUNT status. No catch-all route is exposed.

Environment: `TABLE_NAME`, `MEDIA_BUCKET`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`. ZIP must contain `content_api/`, `shared/` and dependencies at its root.
IAM permits required table operations/GSI1 Query, only media S3 object/version operations and prefix-restricted ListBucketVersions; no Cognito admin access.

The same Lambda consumes REMOVE events whose old PK starts `MEDIA#`. Partial batch failures, batch bisection, bounded retries, a 14-day encrypted SQS failure destination, Lambda errors/throttles, iterator-age and queue alarms are configured. SQS stream failure messages contain shard/sequence metadata, not a durable backup of the removed item: investigate before the 24-hour stream retention expires. Do not blindly replay deletion work against restored content.

Required inputs are documented by `variables.tf`. Optional existing ACM regional certificate/domain/Route53 zone enable a custom hostname. API and Lambda logs exclude request bodies/tokens. Outputs include API endpoint, Lambda identifiers and stream failure queue URL.
