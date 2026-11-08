import json
from pathlib import Path

_RESOURCES = json.loads(Path(__file__).with_name("resources.json").read_text(encoding="utf-8"))
_BY_ID = {resource["id"]: resource for resource in _RESOURCES}


def list_resources() -> list[dict]:
    return _RESOURCES


def get_resource(resource_id: str) -> dict | None:
    return _BY_ID.get(resource_id)


def resource_ids() -> set[str]:
    return set(_BY_ID)
