# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml==6.0.3"]
# ///
"""Inwentarz Indico: statyczny odczyt źródeł Indico i indico-plugins (bez uruchamiania ich kodu).

Uruchomienie: zobacz README.md w tym katalogu.
Wynik jest deterministyczny: te same źródła i te same pliki przypisań dają identyczny JSON.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import yaml

INDICO_COMMIT = "7bc32f2fe889943ef5df9c00ddfe868c9720cd34"
F1_POWODY = {"a", "b", "c", "d"}

# Bazowe klasy enumów używane w Indico (indico/util/enum.py) i w bibliotece standardowej.
ENUM_BASES = {"Enum", "IntEnum", "StrEnum", "IndicoEnum", "IndicoIntEnum", "IndicoStrEnum", "RichEnum", "RichIntEnum", "RichStrEnum"}
# Nazwy enumów, które opisują stan obiektu albo tryb, w którym obiekt się znajduje (G4).
STATE_NAME = re.compile(r"(State|Status|Mode|ProtectionMode|Action|Type)$")


@dataclass(frozen=True)
class Sources:
    indico: Path
    plugins: Path


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def git_head(repo: Path) -> str:
    return subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()


def py_files(root: Path, base: str) -> list[Path]:
    return sorted(p for p in (root / base).rglob("*.py") if not p.name.endswith("_test.py") and "/tests/" not in p.as_posix())


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def literal(node: ast.AST | None) -> object:
    if node is None:
        return None
    try:
        return ast.literal_eval(node)
    except (ValueError, SyntaxError):
        return ast.unparse(node)


def call_name(node: ast.Call) -> str:
    return ast.unparse(node.func)


def kwarg(node: ast.Call, name: str) -> ast.AST | None:
    return next((k.value for k in node.keywords if k.arg == name), None)


def module_of(path: str) -> str:
    parts = path.split("/")
    if parts[:2] == ["indico", "modules"] and len(parts) > 3:
        return parts[2]
    return "/".join(parts[1:3]) if len(parts) > 2 else parts[0]


# ---------------------------------------------------------------------------------------------- trasy


def routes(src: Sources) -> list[dict]:
    items: list[dict] = []
    for path in sorted(src.indico.joinpath("indico").rglob("blueprint.py")):
        if "/tests/" in path.as_posix():
            continue
        tree = parse(path)
        file = rel(path, src.indico)
        blueprints: dict[str, dict] = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and call_name(node.value).endswith("IndicoBlueprint"):
                name = literal(node.value.args[0]) if node.value.args else None
                prefix = literal(kwarg(node.value, "url_prefix")) or ""
                for target in node.targets:
                    blueprints[ast.unparse(target)] = {"name": name, "prefix": prefix, "feature": literal(kwarg(node.value, "event_feature"))}
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "add_url_rule"):
                continue
            owner = ast.unparse(node.func.value)
            bp = blueprints.get(owner, {"name": owner, "prefix": "", "feature": None})
            rule = literal(node.args[0]) if node.args else literal(kwarg(node, "rule"))
            endpoint = literal(node.args[1]) if len(node.args) > 1 else literal(kwarg(node, "endpoint"))
            handler = ast.unparse(node.args[2]) if len(node.args) > 2 else ast.unparse(kwarg(node, "view_func") or ast.Constant(None))
            methods = literal(kwarg(node, "methods")) or ("GET",)
            path_text = rule if isinstance(rule, str) else f"<wyrażenie: {rule}>"
            items.append({
                "id": f"trasa:{bp['name']}:{endpoint}:{node.lineno}",
                "rodzaj": "trasa",
                "blueprint": bp["name"],
                "sciezka": f"{bp['prefix']}{path_text}" if isinstance(rule, str) else f"{bp['prefix']}{path_text}",
                "endpoint": endpoint,
                "metody": sorted(methods) if isinstance(methods, (list, tuple)) else [str(methods)],
                "obsluga": handler.split(".")[-1],
                "funkcja_wydarzenia": bp["feature"],
                "plik": f"{file}:{node.lineno}",
            })
    return items


def rh_classes(src: Sources) -> int:
    return sum(1 for p in py_files(src.indico, "indico") for n in ast.walk(parse(p)) if isinstance(n, ast.ClassDef) and n.name.startswith("RH"))


# ---------------------------------------------------------------------------------------------- tabele


def column_names(cls: ast.ClassDef) -> list[str]:
    cols = []
    for stmt in cls.body:
        if isinstance(stmt, ast.Assign) and isinstance(stmt.value, ast.Call) and call_name(stmt.value) in {"db.Column", "Column", "sa.Column"}:
            cols.extend(ast.unparse(t) for t in stmt.targets)
    return cols


TABLE_ARGS = {"__table_args__", "__auto_table_args"}


def table_args_schema(cls: ast.ClassDef) -> str | None:
    for stmt in cls.body:
        nodes = []
        if isinstance(stmt, ast.Assign) and any(ast.unparse(t) in TABLE_ARGS for t in stmt.targets):
            nodes = [stmt.value]
        elif isinstance(stmt, ast.FunctionDef) and stmt.name in TABLE_ARGS:
            nodes = [n for n in ast.walk(stmt) if isinstance(n, ast.Return) and n.value is not None]
            nodes = [n.value for n in nodes]
        for value in nodes:
            for d in ast.walk(value):
                if isinstance(d, ast.Dict):
                    for k, v in zip(d.keys, d.values):
                        if k is not None and literal(k) == "schema":
                            return str(literal(v))
                if isinstance(d, ast.Call):
                    s = kwarg(d, "schema")
                    if s is not None:
                        return str(literal(s))
    return None


def tables(src: Sources) -> list[dict]:
    """Tabele modeli (klasy nieabstrakcyjne z db.Model w hierarchii; nazwa i schemat mogą być dziedziczone) i tabele asocjacyjne db.Table."""
    classes: dict[str, dict] = {}
    items = []
    for path in py_files(src.indico, "indico"):
        tree = parse(path)
        file = rel(path, src.indico)
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                assigns = {ast.unparse(t): s.value for s in node.body if isinstance(s, ast.Assign) for t in s.targets}
                classes[node.name] = {
                    "bases": [ast.unparse(b).split(".")[-1] if ast.unparse(b) != "db.Model" else "db.Model" for b in node.bases],
                    "tablename": literal(assigns["__tablename__"]) if "__tablename__" in assigns else None,
                    "abstract": literal(assigns.get("__abstract__")) is True,
                    "schema": table_args_schema(node),
                    "columns": column_names(node),
                    "where": f"{file}:{node.lineno}",
                }
            if isinstance(node, ast.Call) and call_name(node) == "db.Table" and node.args and isinstance(node.args[0], ast.Constant):
                name = literal(node.args[0])
                schema = literal(kwarg(node, "schema")) or "public"
                cols = [literal(a.args[0]) for a in node.args[2:] if isinstance(a, ast.Call) and call_name(a) in {"db.Column", "Column"} and a.args]
                items.append({"id": f"tabela:{schema}.{name}", "rodzaj": "tabela", "nazwa": f"{schema}.{name}", "model": None, "kolumny": [str(c) for c in cols], "plik": f"{file}:{node.lineno}"})

    def lineage(name: str) -> list[dict]:
        seen, order, stack = set(), [], [name]
        while stack:
            current = stack.pop(0)
            if current in seen or current not in classes:
                continue
            seen.add(current)
            order.append(classes[current])
            stack.extend(classes[current]["bases"])
        return order

    for name, info in sorted(classes.items()):
        if info["abstract"]:
            continue
        chain = lineage(name)
        if not any("db.Model" in c["bases"] for c in chain):
            continue
        owner = next((c for c in chain if isinstance(c["tablename"], str)), None)
        if owner is None:
            continue
        if owner is not info and not owner["abstract"] and "db.Model" in owner["bases"]:
            continue  # dziedziczenie w jednej tabeli (polimorfizm): tabela należy do klasy bazowej
        tablename = owner["tablename"]
        schema = next((c["schema"] for c in chain if c["schema"]), "public")
        items.append({"id": f"tabela:{schema}.{tablename}", "rodzaj": "tabela", "nazwa": f"{schema}.{tablename}", "model": name, "kolumny": [col for c in chain for col in c["columns"]], "plik": info["where"]})
    return items


# ---------------------------------------------------------------------------------------------- enumy


def enums(src: Sources) -> list[dict]:
    items = []
    for path in py_files(src.indico, "indico"):
        if "/migrations/" in path.as_posix():
            continue  # historyczne kopie enumów w migracjach Alembic
        tree = parse(path)
        file = rel(path, src.indico)
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            bases = {ast.unparse(b).split(".")[-1] for b in node.bases if ast.unparse(b) != "fields.Enum"}
            if not bases & ENUM_BASES or node.name in ENUM_BASES:
                continue
            values = [ast.unparse(t) for s in node.body if isinstance(s, ast.Assign) for t in s.targets if not ast.unparse(t).startswith("_") and ast.unparse(t) != "__titles__"]
            items.append({
                "id": f"enum:{file}:{node.name}",
                "rodzaj": "enum",
                "nazwa": node.name,
                "wartosci": values,
                "stan_obiektu": bool(STATE_NAME.search(node.name)),
                "plik": f"{file}:{node.lineno}",
            })
    return items


# ---------------------------------------------------------------------------------------------- sygnały


def signals(src: Sources) -> list[dict]:
    items = []
    base = src.indico / "indico/core/signals"
    for path in sorted(base.rglob("*.py")):
        tree = parse(path)
        file = rel(path, src.indico)
        namespace = rel(path, base).removesuffix(".py").replace("/__init__", "").replace("/", ".")
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and call_name(node.value).endswith(".signal"):
                name = literal(node.value.args[0])
                items.append({"id": f"sygnal:{namespace}.{name}", "rodzaj": "sygnal", "nazwa": f"{namespace}.{name}", "zmienna": ast.unparse(node.targets[0]), "plik": f"{file}:{node.lineno}"})
    return items


# ---------------------------------------------------------------------------------------------- ustawienia


def settings(src: Sources) -> list[dict]:
    path = src.indico / "docs/source/config/settings.rst"
    section = None
    items = []
    lines = path.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines):
        if i + 1 < len(lines) and re.fullmatch(r"[-~=^]{3,}", lines[i + 1]) and line.strip() and not line.startswith(".."):
            section = line.strip()
        m = re.match(r"^\.\. data:: (\w+)", line)
        if m:
            items.append({"id": f"ustawienie:{m.group(1)}", "rodzaj": "ustawienie", "nazwa": m.group(1), "sekcja": section, "plik": f"docs/source/config/settings.rst:{i + 1}"})
    return items


# ---------------------------------------------------------------------------------------------- CLI i zadania


def cli_commands(src: Sources) -> list[dict]:
    items = []
    for path in py_files(src.indico, "indico"):
        tree = parse(path)
        file = rel(path, src.indico)
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for dec in node.decorator_list:
                call = dec if isinstance(dec, ast.Call) else None
                name = ast.unparse(call.func if call else dec)
                if name.endswith(".command") or name in {"cli_command", "cli_group"} or name.endswith(".group"):
                    explicit = literal(call.args[0]) if call and call.args else None
                    group = name.rsplit(".", 1)[0] if "." in name else name
                    cmd = explicit if isinstance(explicit, str) else node.name.replace("_", "-")
                    items.append({"id": f"cli:{file}:{group}:{cmd}", "rodzaj": "cli", "nazwa": cmd, "grupa": group, "plik": f"{file}:{node.lineno}"})
    return items


def tasks(src: Sources) -> list[dict]:
    items = []
    for path in py_files(src.indico, "indico"):
        tree = parse(path)
        file = rel(path, src.indico)
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for dec in node.decorator_list:
                call = dec if isinstance(dec, ast.Call) else None
                name = ast.unparse(call.func if call else dec)
                if name in {"celery.task", "celery.periodic_task"}:
                    task_name = literal(kwarg(call, "name")) if call else None
                    schedule = ast.unparse(kwarg(call, "run_every")) if call and kwarg(call, "run_every") is not None else None
                    items.append({
                        "id": f"zadanie:{file}:{node.name}",
                        "rodzaj": "zadanie",
                        "nazwa": task_name or node.name,
                        "cykliczne": name == "celery.periodic_task",
                        "harmonogram": schedule,
                        "plik": f"{file}:{node.lineno}",
                    })
    return items


# ---------------------------------------------------------------------------------------------- HTTP API


def api_exporters(src: Sources) -> list[dict]:
    items = []
    for path in py_files(src.indico, "indico"):
        tree = parse(path)
        file = rel(path, src.indico)
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and any(ast.unparse(d) == "HTTPAPIHook.register" for d in node.decorator_list):
                types = next((literal(s.value) for s in node.body if isinstance(s, ast.Assign) and any(ast.unparse(t) == "TYPES" for t in s.targets)), None)
                prefix = next((literal(s.value) for s in node.body if isinstance(s, ast.Assign) and any(ast.unparse(t) == "PREFIX" for t in s.targets)), "export")
                items.append({"id": f"eksporter:{node.name}", "rodzaj": "eksporter_api", "nazwa": node.name, "prefiks": prefix, "typy": list(types) if isinstance(types, (list, tuple)) else types, "plik": f"{file}:{node.lineno}"})
    for path in sorted((src.indico / "indico/web/http_api/metadata").glob("*.py")):
        if path.stem not in {"__init__", "serializer"}:
            items.append({"id": f"eksporter:format:{path.stem}", "rodzaj": "eksporter_api", "nazwa": f"format {path.stem}", "prefiks": None, "typy": None, "plik": rel(path, src.indico)})
    return items


def api_doc_chapters(src: Sources) -> list[dict]:
    base = src.indico / "docs/source/api"
    return [{"id": f"rozdzial_api:{p.stem}", "rodzaj": "rozdzial_api", "nazwa": p.stem, "plik": rel(p, src.indico)} for p in sorted(base.glob("*.rst")) if p.stem not in {"index", "_intro"}]


# ---------------------------------------------------------------------------------------------- moduły, funkcje, uprawnienia, lokalizacje


def modules(src: Sources) -> list[dict]:
    base = src.indico / "indico/modules"
    items = []
    for d in sorted(p for p in base.iterdir() if p.is_dir() and (p / "__init__.py").exists()):
        items.append({"id": f"modul:{d.name}", "rodzaj": "modul", "nazwa": d.name, "plik": rel(d, src.indico)})
        for sub in sorted(p for p in d.iterdir() if p.is_dir() and (p / "__init__.py").exists() and p.name not in {"controllers", "models", "templates", "client", "tests", "api"}):
            items.append({"id": f"podmodul:{d.name}/{sub.name}", "rodzaj": "podmodul", "nazwa": f"{d.name}/{sub.name}", "plik": rel(sub, src.indico)})
    return items


def subclasses(src: Sources, base_name: str, kind: str) -> list[dict]:
    items = []
    for path in py_files(src.indico, "indico"):
        tree = parse(path)
        file = rel(path, src.indico)
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and any(ast.unparse(b).split(".")[-1] == base_name for b in node.bases):
                name = next((literal(s.value) for s in node.body if isinstance(s, ast.Assign) and any(ast.unparse(t) == "name" for t in s.targets)), node.name)
                items.append({"id": f"{kind}:{name}:{file}", "rodzaj": kind, "nazwa": name, "klasa": node.name, "plik": f"{file}:{node.lineno}"})
    return items


def locales(src: Sources) -> list[dict]:
    base = src.indico / "indico/translations"
    return [{"id": f"lokalizacja:{p.name}", "rodzaj": "lokalizacja", "nazwa": p.name, "plik": rel(p, src.indico)} for p in sorted(base.iterdir()) if p.is_dir() and (p / "LC_MESSAGES").exists()]


def plugins(src: Sources) -> list[dict]:
    return [{"id": f"wtyczka:{p.name}", "rodzaj": "wtyczka", "nazwa": p.name, "plik": f"indico-plugins/{p.name}"} for p in sorted(src.plugins.iterdir()) if p.is_dir() and not p.name.startswith((".", "_"))]


# ---------------------------------------------------------------------------------------------- przypisania


CATALOG_FIELDS = ["id", "domena", "tytul", "zachowanie", "role", "dowod_indico", "interfejs", "status", "wylaczenie", "realizacja", "plan", "testy"]
ROLES = {"anonim", "uczestnik", "organizator", "administrator"}
INTERFACES = {"mobilny", "desktop", "tablet", "api", "cli", "tlo"}
STATUSES = {"wymagana", "wylaczona", "do-decyzji"}
ROW_ID = re.compile(r"^F-([A-Z0-9]{2,4})-\d{2}(\.\d+)*$")


def validate_catalog(rows: list[dict], indico: Path) -> list[str]:
    """Sprawdza schemat z sekcji 4.2 briefu. Zwraca listę błędów."""
    errors = []
    seen: set[str] = set()
    for row in rows:
        rid = row.get("id", "?")
        if list(row.keys()) != CATALOG_FIELDS:
            errors.append(f"{rid}: pola muszą być dokładnie {CATALOG_FIELDS} w tej kolejności, są {list(row.keys())}")
            continue
        m = ROW_ID.match(rid)
        if not m:
            errors.append(f"{rid}: niepoprawny format ID")
        elif m.group(1) != row["domena"]:
            errors.append(f"{rid}: domena {row['domena']} nie zgadza się z ID")
        if rid in seen:
            errors.append(f"{rid}: zduplikowane ID")
        seen.add(rid)
        if not row["tytul"] or not isinstance(row["zachowanie"], list) or not row["zachowanie"]:
            errors.append(f"{rid}: wymagany tytuł i niepusta lista zachowań")
        for b in row["zachowanie"] or []:
            if not (isinstance(b, str) and b.startswith("Gdy ") and ", wtedy " in b):
                errors.append(f"{rid}: zachowanie musi mieć postać „Gdy …, wtedy …”: {b!r}")
        if not set(row["role"] or []) <= ROLES:
            errors.append(f"{rid}: nieznane role {set(row['role']) - ROLES}")
        if not set(row["interfejs"] or []) <= INTERFACES or not row["interfejs"]:
            errors.append(f"{rid}: interfejs musi być niepustym podzbiorem {sorted(INTERFACES)}")
        if row["status"] not in STATUSES:
            errors.append(f"{rid}: nieznany status {row['status']}")
        if (row["status"] == "wylaczona") != (row["wylaczenie"] is not None):
            errors.append(f"{rid}: wylaczenie wypełnia się wtedy i tylko wtedy, gdy status = wylaczona")
        if row["wylaczenie"] is not None and (row["wylaczenie"].get("powod") not in F1_POWODY or not row["wylaczenie"].get("uzasadnienie")):
            errors.append(f"{rid}: wyłączenie wymaga powodu z F1 i uzasadnienia")
        if not (row["realizacja"] == "rdzen" or re.fullmatch(r"wtyczka:[a-z0-9-]+", str(row["realizacja"]))):
            errors.append(f"{rid}: realizacja to rdzen albo wtyczka:<nazwa>")
        for ref in row["dowod_indico"] or []:
            target = str(ref).split("::")[0]
            if not (indico / target).exists() and not target.startswith(("indico-plugins/", "CHANGES.rst", "docs/", "brak")):
                errors.append(f"{rid}: ścieżka dowodu nie istnieje w Indico: {target}")
        if row["plan"] is not None or row["testy"] != []:
            errors.append(f"{rid}: plan i testy uzupełnia się później (plan: null, testy: [])")
    # Wiersz podzielony nie istnieje obok swoich części.
    for rid in seen:
        if any(other.startswith(rid + ".") for other in seen):
            errors.append(f"{rid}: wiersz podzielony nie może istnieć obok swoich części")
    return errors


def load_catalog(path: Path) -> list[dict]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or []


def load_rules(directory: Path) -> list[dict]:
    rules: list[dict] = []
    for path in sorted(directory.glob("*.yaml")):
        for i, rule in enumerate(yaml.safe_load(path.read_text(encoding="utf-8")) or []):
            rule["_zrodlo"] = f"{path.name}#{i + 1}"
            rules.append(rule)
    return rules


def matches(rule: dict, item: dict) -> bool:
    """Reguła pasuje, gdy pasują wszystkie jej warunki. Warunki: rodzaj, id, id_regex, pole: wartość, pole_regex."""
    if rule.get("rodzaj") and rule["rodzaj"] != item["rodzaj"]:
        return False
    for key, expected in rule.get("gdy", {}).items():
        if key.endswith("_regex"):
            value = item.get(key.removesuffix("_regex"))
            if value is None or not re.search(expected, json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value):
                return False
        elif item.get(key) != expected:
            return False
    return True


def assign(items: list[dict], rules: list[dict], catalog_ids: set[str]) -> list[str]:
    """W obrębie jednego pliku reguł wygrywa pierwsza pasująca reguła; pozycja może pasować tylko do jednego pliku. Zwraca listę błędów."""
    errors = []
    for rule in rules:
        if ("funkcja" in rule) == ("wylaczenie" in rule):
            errors.append(f"{rule['_zrodlo']}: reguła musi mieć dokładnie jedno z pól funkcja albo wylaczenie")
        if "funkcja" in rule and rule["funkcja"] not in catalog_ids:
            errors.append(f"{rule['_zrodlo']}: funkcja {rule['funkcja']} nie istnieje w katalogu")
        if "wylaczenie" in rule and (rule["wylaczenie"].get("powod") not in F1_POWODY or not rule["wylaczenie"].get("uzasadnienie")):
            errors.append(f"{rule['_zrodlo']}: wyłączenie wymaga powodu z F1 (a-d) i uzasadnienia")
    used: Counter[str] = Counter()
    for item in items:
        per_file: dict[str, dict] = {}
        for rule in rules:
            source = rule["_zrodlo"].split("#")[0]
            if source not in per_file and matches(rule, item):
                per_file[source] = rule
        if len(per_file) > 1:
            errors.append(f"{item['id']}: pasuje do reguł z kilku plików: {sorted(r['_zrodlo'] for r in per_file.values())}")
        rule = next(iter(per_file.values()), None)
        item["funkcja"] = rule.get("funkcja") if rule else None
        item["wylaczenie"] = rule.get("wylaczenie") if rule else None
        item["regula"] = rule["_zrodlo"] if rule else None
        if rule:
            used[rule["_zrodlo"]] += 1
    errors += [f"{r['_zrodlo']}: reguła nie pasuje do żadnej pozycji" for r in rules if used[r["_zrodlo"]] == 0]
    return errors


# ---------------------------------------------------------------------------------------------- główny przebieg


def build(src: Sources) -> list[dict]:
    items = (
        routes(src) + tables(src) + enums(src) + signals(src) + settings(src) + cli_commands(src) + tasks(src)
        + api_exporters(src) + api_doc_chapters(src) + modules(src)
        + subclasses(src, "EventFeature", "funkcja_wydarzenia") + subclasses(src, "ManagementPermission", "uprawnienie")
        + locales(src) + plugins(src)
    )
    ids = Counter(i["id"] for i in items)
    dupes = [k for k, v in ids.items() if v > 1]
    if dupes:
        raise SystemExit(f"Zduplikowane identyfikatory pozycji: {dupes[:10]}")
    return sorted(items, key=lambda i: (i["rodzaj"], i["id"]))


def main() -> int:
    here = Path(__file__).resolve().parent
    parity = here.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--indico", type=Path, required=True, help="klon indico na commicie wzorca")
    parser.add_argument("--plugins", type=Path, required=True, help="klon indico-plugins")
    parser.add_argument("--katalog", type=Path, default=parity / "katalog-funkcji.yaml")
    parser.add_argument("--przypisania", type=Path, default=here / "przypisania")
    parser.add_argument("--wyjscie", type=Path, default=parity / "inwentarz-indico.json")
    parser.add_argument("--bez-przypisan", action="store_true", help="tylko ekstrakcja, bez katalogu i reguł")
    parser.add_argument("--pozycje", type=Path, help="plik JSON z listą ID pozycji: sprawdzaj tylko te (praca nad częścią inwentarza)")
    args = parser.parse_args()

    src = Sources(args.indico.resolve(), args.plugins.resolve())
    head = git_head(src.indico)
    if head != INDICO_COMMIT:
        print(f"Klon indico jest na {head}, oczekiwano {INDICO_COMMIT}", file=sys.stderr)
        return 2

    items = build(src)
    if args.pozycje:
        wanted = set(json.loads(args.pozycje.read_text(encoding="utf-8")))
        items = [i for i in items if i["id"] in wanted]
    errors: list[str] = []
    if not args.bez_przypisan:
        catalog = load_catalog(args.katalog)
        errors = validate_catalog(catalog, src.indico)
        errors += assign(items, load_rules(args.przypisania), {row["id"] for row in catalog})

    counts = Counter(i["rodzaj"] for i in items)
    assigned = sum(1 for i in items if i.get("funkcja"))
    excluded = sum(1 for i in items if i.get("wylaczenie"))
    unassigned = [i["id"] for i in items if not i.get("funkcja") and not i.get("wylaczenie")]
    test_files = sum(1 for _ in src.indico.rglob("*_test.py"))
    summary = {
        "zrodla": {"indico": head, "indico_plugins": git_head(src.plugins)},
        "liczby": {
            **dict(sorted(counts.items())),
            "klasy_RH": rh_classes(src),
            "pliki_testow_python": test_files,
            "add_url_rule_w_blueprint_py": counts["trasa"],
        },
        "przypisania": {"przypisane": assigned, "wylaczone": excluded, "nieprzypisane": len(unassigned)},
    }
    out = {**summary, "pozycje": items}
    args.wyjscie.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    for e in errors:
        print(f"BŁĄD: {e}", file=sys.stderr)
    if not args.bez_przypisan and unassigned:
        print(f"Nieprzypisane pozycje ({len(unassigned)}), pierwsze: {unassigned[:20]}", file=sys.stderr)
    return 1 if errors or (unassigned and not args.bez_przypisan) else 0


if __name__ == "__main__":
    raise SystemExit(main())
