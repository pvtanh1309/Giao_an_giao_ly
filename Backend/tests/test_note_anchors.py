import json
from pathlib import Path
import pytest
from shared.errors import ApiError
from content_api.services.note_anchors import canonical_field_text, make_anchor, validate_anchor, resolve_anchor

FIXTURES = json.loads((Path(__file__).parent / 'fixtures/lesson_note_anchors.json').read_text(encoding='utf-8'))

@pytest.mark.parametrize('fixture', FIXTURES)
def test_canonical_offsets_and_validation(fixture):
    text = canonical_field_text(fixture['value'])
    assert text == fixture['text']
    anchor = make_anchor('scripture', text, fixture['start'], fixture['end'])
    assert anchor['exactQuote'] == fixture['quote']
    assert validate_anchor({'scriptureText': text}, anchor) == anchor
    assert resolve_anchor(text, anchor) == (fixture['start'], fixture['end'])

def test_reanchors_only_unique_context_and_detaches_changed_quote():
    anchor = make_anchor('scripture', 'Trước Lời Chúa sau', 6, 13)
    assert resolve_anchor('Mới Trước Lời Chúa sau', anchor) == (10, 17)
    assert resolve_anchor('Trước lời khác sau', anchor) is None
    assert resolve_anchor('Trước Lời Chúa sau Trước Lời Chúa sau', anchor) is None
    with pytest.raises(ApiError) as error:
        validate_anchor({'scriptureText': 'changed'}, anchor)
    assert error.value.status == 409
