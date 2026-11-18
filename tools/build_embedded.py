#!/usr/bin/env python3
"""
Irreality · сборка assets/js/embedded.js из modules/*.json.

embedded.js — резервная копия модулей для file:// и недоступного /modules.
Этот скрипт генерирует его целиком: правьте JSON в modules/, затем запускайте.

Запуск из корня проекта:
    python tools/build_embedded.py               # собрать
    python tools/build_embedded.py --check       # проверить актуальность (для CI), ничего не пишет
    python tools/build_embedded.py --compact     # минифицированный вариант
    python tools/build_embedded.py --modules modules --out assets/js/embedded.js
    python tools/build_embedded.py --force       # собрать даже при ошибках валидации

Коды возврата: 0 — ок, 1 — ошибки валидации / несовпадение в --check, 2 — ошибка чтения файлов.
Требуется Python 3.8+, только стандартная библиотека.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------- вывод в консоль (Windows-консоль может быть не в UTF-8) ----------
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

RULE_TYPES = {"toggle", "number", "select"}
ID_ARRAYS = ("plates", "ammo", "carriers", "fireModes", "weaponClasses",
             "covers", "weapons", "rules", "damageTypes")


class Problem(Exception):
    pass


def load_json(path: Path):
    try:
        raw = path.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        raise Problem(f"файл не найден: {path}")
    except OSError as e:
        raise Problem(f"не читается {path}: {e}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise Problem(f"{path}: некорректный JSON — {e}")


# ---------- сериализация: JS-объект, мелкие объекты в одну строку ----------
def js(value, indent=2, level=0, inline=False, max_inline=110):
    pad, pad_in = " " * (indent * level), " " * (indent * (level + 1))
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [f"{json.dumps(str(k), ensure_ascii=False)}: {js(v, indent, level + 1, inline, max_inline)}"
                 for k, v in value.items()]
        one = "{ " + ", ".join(items) + " }"
        if inline or len(one) <= max_inline:
            return one
        return "{\n" + pad_in + (",\n" + pad_in).join(items) + "\n" + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        items = [js(v, indent, level + 1, True, max_inline) for v in value]
        one = "[" + ", ".join(items) + "]"
        if inline or len(one) <= max_inline:
            return one
        return "[\n" + pad_in + (",\n" + pad_in).join(items) + "\n" + pad + "]"
    return json.dumps(value, ensure_ascii=False)


def render(reg_entries, manifests, compact=False, stamp=True) -> str:
    cmd = "python tools/build_embedded.py" + (" --compact" if compact else "")
    lines = [
        "/* ============================================================",
        " * IRREALITY · ВСТРОЕННЫЕ КОПИИ МОДУЛЕЙ — резерв для file://",
        " * и недоступного /modules. ФАЙЛ СГЕНЕРИРОВАН АВТОМАТИЧЕСКИ.",
        " * Не правьте вручную: источник — modules/*.json.",
        f" * Пересборка: {cmd}",
    ]
    if stamp:
        lines.append(" * Собрано (UTC): " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
    lines.append(" * ============================================================ */")
    head = "\n".join(lines)
    if compact:
        body = ("window.IR_EMBEDDED = " +
                js({"registry": reg_entries, "manifests": manifests}, inline=True) + ";")
    else:
        body = ("window.IR_EMBEDDED = {\n"
                "  registry: " + js(reg_entries, level=1) + ",\n"
                                                            "  manifests: " + js(manifests, level=1) + "\n};")
    return head + "\n" + body + "\n"


# ---------- валидация манифеста (мягкая: предупреждения не блокируют) ----------
def validate_manifest(m, label):
    errors, warnings = [], []
    if not isinstance(m, dict):
        return [f"{label}: манифест должен быть JSON-объектом"], warnings

    mid = m.get("id")
    if not isinstance(mid, str) or not mid:
        errors.append(f"{label}: отсутствует строковое поле id")
    if not m.get("name"):
        warnings.append(f"{label}: нет name")
    ns = m.get("namespace")
    if not isinstance(ns, str) or not ns or not ns[0].isalpha() or not all(
            c.islower() or c.isdigit() or c == "-" for c in ns):
        errors.append(f"{label}: namespace должен быть строчным латинским идентификатором (a-z, 0-9, дефис)")
    if m.get("kind") not in (None, "core", "module"):
        errors.append(f"{label}: kind должен быть core или module")

    for key in ID_ARRAYS + ("attributes", "skills", "carrierExtensions", "requires"):
        if key in m and not isinstance(m[key], list):
            errors.append(f"{label}: поле {key} должно быть массивом")

    for p in m.get("plates", []) or []:
        if not isinstance(p, dict) or not p.get("id"):
            errors.append(f"{label}: пластина без id")
            continue
        for f in ("defense", "integrity"):
            if not isinstance(p.get(f), (int, float)):
                errors.append(f"{label}: пластина {p.get('code') or p['id']} — {f} должен быть числом")

    for r in m.get("rules", []) or []:
        if not isinstance(r, dict) or not r.get("id"):
            errors.append(f"{label}: правило без id")
            continue
        if r.get("type") not in RULE_TYPES:
            errors.append(f"{label}: правило {r['id']} — type должен быть toggle/number/select")

    for key in ("attributes", "skills"):
        for entry in m.get(key, []) or []:
            ok = isinstance(entry, str) or (
                    isinstance(entry, dict) and (isinstance(entry.get("name"), str) or isinstance(entry.get("names"), list)))
            if not ok:
                errors.append(f"{label}: {key} — ожидается строка или {{group, names}}")

    for key in ID_ARRAYS:
        seen = set()
        for item in m.get(key, []) or []:
            if isinstance(item, dict) and item.get("id"):
                if item["id"] in seen:
                    errors.append(f"{label}: дубликат id «{item['id']}» в {key}")
                seen.add(item["id"])

    return errors, warnings


# ---------- сборка ----------
def build(args):
    modules_dir, out_path = Path(args.modules), Path(args.out)
    errors, warnings = [], []

    try:
        registry = load_json(modules_dir / "index.json")
        if not isinstance(registry, dict) or not isinstance(registry.get("modules"), list):
            raise Problem("index.json: ожидается объект с массивом modules")

        entries, manifests = [], {}
        seen_ids, seen_ns = {}, {}

        for raw in registry["modules"]:
            if isinstance(raw, str):
                ent = {"id": Path(raw).stem, "file": raw}
            elif isinstance(raw, dict) and raw.get("file"):
                ent = {k: v for k, v in raw.items() if v is not None}
                ent.setdefault("id", Path(raw["file"]).stem)
            else:
                errors.append(f"index.json: некорректная запись {raw!r}")
                continue

            mid, file = ent["id"], ent["file"]
            if "required" in ent and not isinstance(ent["required"], bool):
                errors.append(f"{mid}: required должен быть true/false")
            if mid in seen_ids:
                errors.append(f"index.json: дубликат id «{mid}»")
                continue
            seen_ids[mid] = file
            if Path(file).stem != mid:
                warnings.append(f"{mid}: имя файла ({file}) не совпадает с id")

            try:
                man = load_json(modules_dir / file)
            except Problem as e:
                errors.append(str(e))
                continue

            errs, warns = validate_manifest(man, file)
            errors += errs
            warnings += warns

            if isinstance(man, dict):
                if man.get("id") and man["id"] != mid:
                    errors.append(f"{file}: id манифеста «{man['id']}» ≠ id реестра «{mid}»")
                ns = man.get("namespace")
                if isinstance(ns, str) and ns:
                    if ns in seen_ns:
                        errors.append(f"{file}: namespace «{ns}» уже занят модулем {seen_ns[ns]}")
                    else:
                        seen_ns[ns] = mid
                if ent.get("required") and man.get("kind") != "core":
                    warnings.append(f"{mid}: required=true, но kind не core")
                if man.get("kind") == "core" and not ent.get("required"):
                    warnings.append(f"{mid}: kind=core — стоит добавить required:true в реестр")

            entries.append(ent)
            manifests[mid] = man

        # зависимости
        for ent in entries:
            man = manifests.get(ent["id"])
            if not isinstance(man, dict):
                continue
            for dep in man.get("requires", []) or []:
                if dep not in manifests:
                    errors.append(f"{ent['id']}: зависимость «{dep}» отсутствует в реестре")

        if not any(isinstance(m, dict) and m.get("kind") == "core" for m in manifests.values()):
            errors.append("ни один модуль не помечен kind=core — ядро обязательно")

    except Problem as e:
        print(f"ОШИБКА: {e}", file=sys.stderr)
        return 2

    for w in warnings:
        print(f"  предупреждение: {w}")
    for e in errors:
        print(f"  ОШИБКА: {e}", file=sys.stderr)

    if errors and not args.force:
        print(f"\nСборка остановлена: ошибок — {len(errors)}. Исправьте JSON или запустите с --force.", file=sys.stderr)
        return 1

    text = render(entries, manifests, compact=args.compact, stamp=not args.no_stamp)

    if args.check:
        if out_path.exists() and out_path.read_text(encoding="utf-8") == text:
            print(f"OK: {out_path} актуален ({len(entries)} модулей).")
            return 0
        print(f"УСТАРЕЛ: {out_path} не совпадает с modules/*.json — запустите python tools/build_embedded.py", file=sys.stderr)
        return 1

    if out_path.exists() and out_path.read_text(encoding="utf-8") == text:
        print(f"Без изменений: {out_path}")
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8", newline="\n")
    size = out_path.stat().st_size
    print(f"Собрано: {out_path} · модулей: {len(entries)} · {size:,} байт".replace(",", " "))
    for ent in entries:
        m = manifests[ent["id"]]
        mark = "ядро" if m.get("kind") == "core" else ("шаблон" if ent.get("example") else "модуль")
        print(f"  · {ent['id']} v{m.get('version', '?')} [{mark}] ← {ent['file']}")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Собрать assets/js/embedded.js из modules/*.json")
    ap.add_argument("--modules", default="modules", help="папка с index.json и манифестами (по умолчанию modules)")
    ap.add_argument("--out", default="assets/js/embedded.js", help="куда писать (по умолчанию assets/js/embedded.js)")
    ap.add_argument("--check", action="store_true", help="только проверить актуальность, ничего не писать; код 1 если устарел")
    ap.add_argument("--compact", action="store_true", help="минифицированный вывод")
    ap.add_argument("--no-stamp", action="store_true", help="без строки времени сборки (детерминированный вывод)")
    ap.add_argument("--force", action="store_true", help="писать даже при ошибках валидации")
    args = ap.parse_args()
    sys.exit(build(args))


if __name__ == "__main__":
    main()