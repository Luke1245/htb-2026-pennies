import json
from pathlib import Path

_GUIDES = json.loads(Path(__file__).with_name("guides.json").read_text(encoding="utf-8"))
_BY_ID = {guide["id"]: guide for guide in _GUIDES}


def list_guides() -> list[dict]:
    return _GUIDES


def get_guide(guide_id: str) -> dict | None:
    return _BY_ID.get(guide_id)


def guide_ids() -> set[str]:
    return set(_BY_ID)
