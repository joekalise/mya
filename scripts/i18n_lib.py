"""Shared helpers for the local Excel-based translation review workflow.

Locale JSON files are namespace -> key -> string, except a few namespaces
(e.g. "onboarding") that nest one level deeper (namespace -> key -> subkey ->
string). These helpers work with full dotted paths ("ns.key" or
"ns.key.subkey") so every script handles both shapes the same way.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ROOT / "src" / "i18n" / "locales"
EN_PATH = LOCALES / "en-GB.json"
ES_PATH = LOCALES / "es.json"
BASELINE_PATH = Path(__file__).resolve().parent / "i18n_baseline.json"
PENDING_PATH = Path(__file__).resolve().parent / "i18n_pending_review.txt"
DEFAULT_XLSX = Path.home() / "Downloads" / "mya_es_review.xlsx"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def flatten(obj, prefix=""):
    """Flatten nested dicts of strings into {full.dotted.path: value}."""
    out = {}
    for k, v in obj.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, path))
        else:
            out[path] = v
    return out


def get_nested(d: dict, dotted_key: str):
    node = d
    for part in dotted_key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def set_nested(d: dict, dotted_key: str, value) -> None:
    parts = dotted_key.split(".")
    node = d
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def read_pending() -> list:
    if not PENDING_PATH.exists():
        return []
    return [line.strip() for line in PENDING_PATH.read_text().splitlines() if line.strip()]


def write_pending(paths: list) -> None:
    PENDING_PATH.write_text("\n".join(paths) + ("\n" if paths else ""))
