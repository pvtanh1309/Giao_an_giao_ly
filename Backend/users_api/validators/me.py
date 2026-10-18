from users_api.validators.catechists import fields, validate_payload


def validate_profile(body):
    fields(body, {'email', 'phone', 'group', 'accompanyingClass', 'version'})
    # Reuse contact validation, without allowing callers to edit name/status.
    result = validate_payload({**body, 'name': 'unchanged'}, updating=True)
    return {key: result.get(key, '') for key in ('email', 'phone', 'group', 'accompanyingClass', 'version')}
