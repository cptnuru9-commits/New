#!/usr/bin/env python3
"""Checks the JSON database for consistency (run after editing Resources/Data or the user copy).
Usage: python3 tools/validate_data.py [data-dir]"""
import json, sys, os

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "Resources", "Data")
heroes = json.load(open(os.path.join(d, "heroes.json"), encoding="utf-8"))["heroes"]
items = json.load(open(os.path.join(d, "items.json"), encoding="utf-8"))["items"]
builds = json.load(open(os.path.join(d, "builds.json"), encoding="utf-8"))

DIMS = {"physical", "magic", "burst", "sustained", "cc", "healing", "shields", "basicAttack", "dive", "tanky"}
ARCH = {"marksman", "assassin_phys", "assassin_magic", "mage", "fighter_phys", "fighter_magic", "tank", "support"}
CATS = {"boots", "physical", "magic", "defense", "support"}
LANES = {"gold", "exp", "mid", "jungle", "roam"}
errors = []
item_ids = {i["id"] for i in items}
tpl_ids = {t["id"] for t in builds["templates"]}

if len(item_ids) != len(items): errors.append("duplicate item ids")
for i in items:
    if i["category"] not in CATS: errors.append(f"{i['id']}: bad category")
    for a in i["usableBy"]:
        if a not in ARCH: errors.append(f"{i['id']}: bad archetype {a}")
    for k, v in i["counters"].items():
        if k not in DIMS: errors.append(f"{i['id']}: bad counter {k}")
        if not 0 <= v <= 1: errors.append(f"{i['id']}: weight {v} outside 0..1")
for t in builds["templates"]:
    if len(t["items"]) != 6: errors.append(f"template {t['id']}: {len(t['items'])} items")
    for it in t["items"]:
        if it not in item_ids: errors.append(f"template {t['id']}: unknown item {it}")
for a, t in builds["archetypeDefaults"].items():
    if a not in ARCH or t not in tpl_ids: errors.append(f"archetypeDefaults {a}->{t}")
names = set()
for h in heroes:
    if h["name"] in names: errors.append(f"duplicate hero {h['name']}")
    names.add(h["name"])
    for lane in h["lanes"]:
        if lane not in LANES: errors.append(f"{h['name']}: bad lane {lane}")
    for k in ("cc", "healing", "shields", "mobility", "tankiness"):
        if not 0 <= h[k] <= 3: errors.append(f"{h['name']}: {k}={h[k]}")
    for lane, t in h["builds"].items():
        if t not in tpl_ids: errors.append(f"{h['name']}: unknown template {t}")
    for ref in h["strongAgainst"] + h["weakAgainst"] + h["synergy"]:
        if ref not in names and ref not in {x["name"] for x in heroes}: errors.append(f"{h['name']}: unknown hero reference {ref}")

print(f"{len(heroes)} heroes ({sum(h['profileSource']=='curated' for h in heroes)} curated), {len(items)} items, {len(tpl_ids)} templates")
if errors:
    print("\n".join("ERROR: " + e for e in errors)); sys.exit(1)
print("OK")
