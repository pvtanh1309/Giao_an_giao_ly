# Infrastructure

Terraform quản lý hai environment root Dev/Prod và bootstrap state riêng. Modules hiện hành: identity, database, app-hosting, Content API routing, lessons-api, catalog-api và user-api.

- Kiến trúc, state, quyền và ranh giới dữ liệu: [CONTEXT](../docs/CONTEXT.md).
- Bootstrap, tfvars, package, OIDC/CD, deploy/rollback/destroy Dev: [RUNBOOK](../docs/RUNBOOK.md).
- Credentials, state, IAM và các lỗi triển khai đã gặp: [TROUBLESHOOTING](../docs/TROUBLESHOOTING.md).
- Log/metric, alarm, queue và cold start: [MONITORING](../docs/MONITORING.md).

Source: [bootstrap](bootstrap/), [Dev](environments/dev/), [Prod](environments/prod/), [modules](modules/), [IAM JSON](iam/). Review account/resource IDs và grants chẩn đoán trong IAM JSON trước khi áp dụng; file local không tự đồng bộ policy AWS.

Runbook cũ và module READMEs đã giữ trong [archive](../docs/archive/README.md). Hướng dẫn vận hành chuẩn chỉ cập nhật tại bốn file trong docs/.
