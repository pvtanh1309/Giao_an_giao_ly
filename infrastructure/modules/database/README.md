# Database
One on-demand DynamoDB table per environment, with string `PK`/`SK`, GSI1 (`GSI1PK`/`GSI1SK`), TTL `purgeAt`, and `NEW_AND_OLD_IMAGES` streams. GSI1 uses INCLUDE projection for metadata only; rich-text documents and schedule cells remain on the base table.

Inputs: `environment`, `project_name`, `tags`, optional `enable_pitr` and `deletion_protection_enabled`. Production always enables PITR and deletion protection.
Outputs: `table_name`, `table_arn`, `stream_arn`.

Runtime owns catalog key values, including global LESSON/PROGRAM catalogs for optional filters. TTL deletion is asynchronous and does not enforce immediate access revocation; API soft-delete/restore checks do. Restore production backups into a new table, verify content and indexes, then deliberately switch application wiring; restoring a table does not recreate external Cognito/S3 assets.
