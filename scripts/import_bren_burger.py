#!/usr/bin/env python3
"""
Импорт меню Bren Burger в магазин через admin API.

Стратегия:
- наценка 10% для товаров дороже 100 ₽; товары ≤ 100 ₽ идут без наценки;
- многоразмерные позиции («Наггетсы 6 9 20») разбиваются на отдельные товары;
- подкатегория «Фастфуд» создаётся, если её ещё нет.

Запуск (нужен Python 3.9+ и requests):
    pip install requests
    BASE_URL=https://yuher.ru ADMIN_USER=admin ADMIN_PASS=•••••• \\
        python3 scripts/import_bren_burger.py

Сначала прогоните с --dry-run, чтобы посмотреть итоговые цены и план импорта:
    python3 scripts/import_bren_burger.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass

STORE_NAME = "Bren Burger"
SUBCATEGORY_NAME = "Фастфуд"
MARKUP = 0.10  # 10%
MARKUP_THRESHOLD = 100  # цена ≤ 100 ₽ — без наценки


@dataclass
class Item:
    name: str
    base_price: int


# (имя, базовая цена) — варианты «6/9/20» развёрнуты в отдельные позиции
MENU: list[Item] = [
    Item("Картошка Фри", 130),
    Item("Картошка по-деревенски", 140),
    Item("Наггетсы 6 шт", 160),
    Item("Наггетсы 9 шт", 210),
    Item("Наггетсы 20 шт", 430),
    Item("Крылышки Острые 6 шт", 330),
    Item("Крылышки Острые 9 шт", 390),
    Item("Крылышки Острые 18 шт", 700),
    Item("Крылышки Гриль 6 шт", 280),
    Item("Крылышки Гриль 9 шт", 380),
    Item("Крылышки Гриль 18 шт", 650),
    Item("Стрипсы 6 шт", 300),
    Item("Стрипсы 9 шт", 400),
    Item("Попкорн", 200),
    Item("Сырные Палочки 6 шт", 200),
    Item("Сырные Палочки 9 шт", 310),
    Item("Сырные Шарики", 130),
    Item("Луковые Кольца 6 шт", 150),
    Item("Шаурма", 200),
    Item("Шаурма в Кляре", 250),
    Item("Шаурма Арабская", 350),
    Item("Шаурма Мексиканская", 200),
    Item("Донар", 180),
    Item("Роллер", 180),
    Item("Биф Ролл Барбекю", 280),
    Item("Биф Ролл Шашлычный", 280),
    Item("Хотдог", 120),
    Item("Хотдог Французский", 120),
    Item("Чипдог", 100),
    Item("Гиро", 200),
    Item("Гиро на Тарелке", 350),
    Item("Гурман", 300),
    Item("Найсмит", 250),
    Item("Сэндвич Клаб", 300),
    Item("Комбо Люкс", 300),
    Item("Комбо Куриный", 350),
    Item("Комбо Премиум", 350),
    Item("Комбо для Школьников", 200),
    Item("Филе с Картошкой Маленькая", 320),
    Item("Филе с Картошкой Большая", 400),
]


def final_price(base: int) -> int:
    if base <= MARKUP_THRESHOLD:
        return base
    return round(base * (1 + MARKUP))


def find_store(session, base_url: str, name: str) -> dict:
    r = session.get(f"{base_url}/api/v1/admin/stores", timeout=15)
    r.raise_for_status()
    stores = r.json() or []
    for s in stores:
        if s.get("name", "").strip().lower() == name.lower():
            return s
    available = ", ".join(sorted(s.get("name", "?") for s in stores))
    raise RuntimeError(f'Магазин "{name}" не найден. Доступные: {available}')


def get_or_create_subcategory(session, base_url: str, store_id: str, name: str) -> str:
    r = session.get(
        f"{base_url}/api/v1/admin/stores/{store_id}/subcategories", timeout=15
    )
    r.raise_for_status()
    for sub in r.json() or []:
        if sub.get("name", "").strip().lower() == name.lower():
            print(f'  ✓ Подкатегория "{name}" уже существует ({sub["id"]})')
            return sub["id"]
    r = session.post(
        f"{base_url}/api/v1/admin/stores/{store_id}/subcategories",
        json={"name": name},
        timeout=15,
    )
    r.raise_for_status()
    sub = r.json()
    print(f'  ✓ Создана подкатегория "{name}" ({sub["id"]})')
    return sub["id"]


def list_existing_products(session, base_url: str, store_id: str) -> set[str]:
    r = session.get(
        f"{base_url}/api/v1/admin/products?store_id={store_id}", timeout=15
    )
    r.raise_for_status()
    return {p.get("name", "").strip().lower() for p in (r.json() or [])}


def create_product(
    session,
    base_url: str,
    store_id: str,
    subcategory_id: str,
    name: str,
    price: int,
) -> None:
    # Бэкенд требует multipart/form-data (там же image upload). Стандартный
    # приём с requests: каждый текстовый параметр идёт как (None, value).
    files = {
        "store_id": (None, store_id),
        "subcategory_id": (None, subcategory_id),
        "name": (None, name),
        "price": (None, str(price)),
        "is_available": (None, "true"),
    }
    r = session.post(
        f"{base_url}/api/v1/admin/products", files=files, timeout=30
    )
    if r.status_code >= 400:
        raise RuntimeError(f"  ✗ {name}: {r.status_code} {r.text}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Только показать план")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BASE_URL", "https://yuher.ru"),
        help="Базовый URL API (по умолчанию https://yuher.ru)",
    )
    parser.add_argument(
        "--user",
        default=os.environ.get("ADMIN_USER"),
        help="Admin BasicAuth user (или env ADMIN_USER)",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("ADMIN_PASS"),
        help="Admin BasicAuth password (или env ADMIN_PASS)",
    )
    args = parser.parse_args()

    # Превью цен — работает без креденшелов
    print("План импорта:")
    print(f"  Магазин: {STORE_NAME}")
    print(f"  Подкатегория: {SUBCATEGORY_NAME}")
    print(f"  Товаров: {len(MENU)}")
    print()
    print(f'  {"Название":40} {"База":>8}  {"Итог":>8}')
    print(f'  {"-" * 40} {"-" * 8}  {"-" * 8}')
    for it in MENU:
        p = final_price(it.base_price)
        markup_note = " (без наценки)" if p == it.base_price else ""
        print(f'  {it.name:40} {it.base_price:>6} ₽  {p:>6} ₽{markup_note}')
    print()

    if args.dry_run:
        print("dry-run: запросов не отправлено")
        return 0

    if not args.user or not args.password:
        print("ERROR: укажи --user и --password (или ADMIN_USER/ADMIN_PASS env)", file=sys.stderr)
        return 1

    try:
        import requests  # noqa: PLC0415
    except ImportError:
        print("ERROR: нужен пакет requests. Установи: pip install requests", file=sys.stderr)
        return 1

    session = requests.Session()
    session.auth = (args.user, args.password)

    print(f"→ Ищу магазин «{STORE_NAME}»...")
    store = find_store(session, args.base_url, STORE_NAME)
    print(f'  ✓ Магазин найден: {store["id"]}')

    print(f'→ Готовлю подкатегорию «{SUBCATEGORY_NAME}»...')
    sub_id = get_or_create_subcategory(session, args.base_url, store["id"], SUBCATEGORY_NAME)

    print("→ Проверяю уже существующие товары (чтобы не дублировать)...")
    existing = list_existing_products(session, args.base_url, store["id"])
    print(f"  ✓ В магазине уже есть {len(existing)} товар(ов)")

    print("→ Создаю товары...")
    created = 0
    skipped = 0
    errors: list[str] = []
    for it in MENU:
        if it.name.lower() in existing:
            print(f'  ↷ Пропускаю «{it.name}» — уже существует')
            skipped += 1
            continue
        try:
            create_product(session, args.base_url, store["id"], sub_id, it.name, final_price(it.base_price))
            print(f'  ✓ «{it.name}» — {final_price(it.base_price)} ₽')
            created += 1
        except Exception as e:  # noqa: BLE001
            errors.append(str(e))
            print(str(e), file=sys.stderr)

    print()
    print(f"Готово. Создано: {created}, пропущено (дубль): {skipped}, ошибок: {len(errors)}")
    return 0 if not errors else 2


if __name__ == "__main__":
    sys.exit(main())
