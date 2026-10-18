def note_key(sub, lesson_id, note_id):
    return {'PK': 'ACCOUNT#' + sub, 'SK': 'LESSONNOTE#' + lesson_id + '#' + note_id}


def quota_key(sub, lesson_id):
    return {'PK': 'ACCOUNT#' + sub, 'SK': 'LESSONNOTECOUNT#' + lesson_id}


def guards(account, meta=None):
    result = [{'check': {'PK': account['PK'], 'SK': 'PROFILE'}, 'version': account['version']}]
    if meta is not None:
        result.append({'check': {'PK': meta['PK'], 'SK': 'META'}, 'version': meta['version']})
    return result
