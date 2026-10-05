"""Pack JSON smoke — gömülü paketler sözdizimi + zorunlu alanlar.

    python3 scripts/smoke_packs.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKS = [
    ROOT / "src" / "packs" / "demo-avatars.json",
    ROOT / "src" / "packs" / "tires-master-data.json",
]
REQUIRED_AGENT = (
    "id",
    "name",
    "role",
    "shape",
    "color",
    "expression",
    "partners",
    "replies",
    "idleState",
    "thinkState",
    "arriveState",
)
SHAPES = {"cercle", "galet", "squircle", "capsule", "triangle", "hexagone", "nuage", "goutte"}


def check(path: Path) -> list[str]:
    errors: list[str] = []
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("transport") not in ("local", "ws"):
        errors.append("transport")
    if data.get("transport") == "ws" and not data.get("url"):
        errors.append("ws url eksik")
    agents = data.get("agents") or []
    if not agents:
        errors.append("agents boş")
    seen: set[str] = set()
    for a in agents:
        for key in REQUIRED_AGENT:
            if key not in a:
                errors.append(f"{a.get('id', '?')}.{key} eksik")
        if a.get("shape") not in SHAPES:
            errors.append(f"{a.get('id')} shape={a.get('shape')}")
        if a["id"] in seen:
            errors.append(f"dup id {a['id']}")
        seen.add(a["id"])
    return errors


def main() -> int:
    bad = 0
    for path in PACKS:
        errors = check(path)
        status = "OK" if not errors else "FAIL " + "; ".join(errors)
        print(f"{path.name}: {len(json.loads(path.read_text(encoding='utf-8'))['agents'])} ajan — {status}")
        bad += bool(errors)
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
