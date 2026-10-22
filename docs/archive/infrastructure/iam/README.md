> **ARCHIVE ? T?i li?u l?ch s?, kh?ng ph?i h??ng d?n hi?n h?nh.**
> Gom ng?y 20/10/2026 t?: infrastructure/iam/README.md. Ngu?n hi?n h?nh: [CONTEXT](../../../CONTEXT.md), c?ng b? RUNBOOK/TROUBLESHOOTING/MONITORING trong docs/.
> N?i dung b?n d??i gi? nguy?n ?? truy nguy?n; ???ng d?n code, ID, tr?ng th?i v? l?nh c? c? th? kh?ng c?n ??ng.

# CD dev IAM diagnosis

`cd-dev-policy.json` is the supplied main policy with only the two Cognito MFA actions added to its existing tag-scoped identity statement. Apply the JSON to IAM explicitly; local files do not update AWS.

`cd-dev-additional-permissions.json` contains a temporary API Gateway diagnostic grant and tag-scoped Cognito MFA permissions. The diagnostic grant allows `apigateway:*` only on the two stage collection ARNs from the failed deployment. It does not grant all API Gateway actions on all resources. POST and PUT on both collections were already allowed by the attached main policy, as confirmed by the user's IAM simulation; repeating those grants would not explain the live TagResource denial.

Hypothesis: the live tag-on-create authorization check requires an action not covered by the documented HTTP verb grants in this environment. The scoped wildcard tests this hypothesis; it is not a verified permanent fix. Check IAM Console validation, review the Terraform plan, and inspect the next deployment's exact error/success before deciding whether to retain or replace the diagnostic grant. Remove the diagnostic statement if the same denial remains; investigate the denied CloudTrail request with AWS Support rather than broadening resource scope. Do not use AdministratorAccess as a workaround.

References: https://docs.aws.amazon.com/service-authorization/latest/reference/list_apigatewayv2.html and https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-tagging-iam-policy.html . The documented HTTP verb mapping does not explain the observed denial; the wildcard step is a diagnostic inference, not an AWS-documented requirement for CreateStage.

No IAM update or live deployment has been performed from this workspace. Local validation checks JSON and ARN scope only.

The next deployment progressed past the API Gateway tagging denial and reported missing `logs:CreateLogDelivery` and `lambda:TagResource` on event source mappings. The additional policy now includes the HTTP API logging delivery permissions documented at https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-logging.html . These use `Resource: "*"` and are limited to `ap-southeast-1`; they manage regional log delivery/resource policies and are not confined to dev log groups. Existing main-policy permissions already cover creation and description of dev log groups.

Event source mapping tag-on-create permission is scoped to this account/region and requires request tags `Project=giaoan` and `Environment=dev`. Terraform provider default tags supply those tags. This is separate from function tagging permissions, which do not cover mapping ARNs. See https://docs.aws.amazon.com/lambda/latest/dg/tags-esm.html . These additions have been checked locally but have not yet been verified by a successful live apply.
