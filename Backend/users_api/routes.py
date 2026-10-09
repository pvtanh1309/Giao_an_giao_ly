"""Fixed route registry; shared HTTP dispatch enforces every group allowlist."""

ROUTES = {
    "GET /manage/catechists": ("users_api.services.catechists.list_management", ("editor", "admin")),
    "GET /catechists": ("users_api.services.catechists.list_profiles", ("reader", "editor", "admin")),
    "POST /manage/catechists": ("users_api.services.catechists.create_profile", ("editor", "admin")),
    "PUT /manage/catechists/{catechistId}": ("users_api.services.catechists.update_profile", ("editor", "admin")),
    "DELETE /manage/catechists/{catechistId}": ("users_api.services.catechists.archive_profile", ("editor", "admin")),
    "POST /manage/catechists/{catechistId}/restore": ("users_api.services.catechists.restore_profile", ("editor", "admin")),
    "GET /admin/accounts": ("users_api.services.accounts.list_accounts", ("admin",)),
    "POST /admin/accounts": ("users_api.services.accounts.create_account", ("admin",)),
    "PUT /admin/accounts/{cognitoSub}/catechist-link": ("users_api.services.accounts.link_catechist", ("admin",)),
    "POST /admin/accounts/{cognitoSub}/reset-password": ("users_api.services.accounts.reset_password", ("admin",)),
    "POST /admin/accounts/{cognitoSub}/disable": ("users_api.services.accounts.disable", ("admin",)),
    "POST /admin/accounts/{cognitoSub}/enable": ("users_api.services.accounts.enable", ("admin",)),
    "DELETE /admin/accounts/{cognitoSub}": ("users_api.services.accounts.archive", ("admin",)),
    "POST /admin/accounts/{cognitoSub}/restore": ("users_api.services.accounts.restore", ("admin",)),
}
