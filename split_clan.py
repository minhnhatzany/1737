import re
import os

funcs_to_move = [
    "actionAdvanceClanMissionIntel", "actionBeginClanMission", "actionChooseClanPatron",
    "actionClanMediate", "actionClanMischief", "actionDropClanPatron",
    "actionExecuteClanMission", "actionSetClanPressureMode", "adjustClanMembersOpinion",
    "changeClanFavor", "clanAvgOpinionToPlayer", "clanSurname", "ensureClanFavorState",
    "getClanPressurePreset", "isClanFriendly", "isClanHostile", "localClanIds",
    "maybeAddClanRivalryCase", "tickClanPressureForCommoner", "tickLocalClansMonthly"
]

with open("engine.js", "rb") as f:
    lines = [l.decode("utf-8") for l in f.readlines()]

out_engine = []
out_clan = []

i = 0
moved_exports = []
all_funcs_in_engine = set()
exported_funcs = set()
all_consts = set()

content = "".join(lines)
for m in re.finditer(r'^(?:export\s+)?function\s+([a-zA-Z0-9_]+)\(', content, re.MULTILINE):
    all_funcs_in_engine.add(m.group(1))
for m in re.finditer(r'^export\s+function\s+([a-zA-Z0-9_]+)\(', content, re.MULTILINE):
    exported_funcs.add(m.group(1))
for m in re.finditer(r'^(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=', content, re.MULTILINE):
    all_consts.add(m.group(1))

for m in re.finditer(r'export\s*\{([^}]+)\}', content):
    parts = m.group(1).split(',')
    for p in parts:
        p = p.strip()
        if p and not p.startswith("from"):
            exported_funcs.add(p)

while i < len(lines):
    line = lines[i]
    match = re.match(r'^(export )?function ([a-zA-Z0-9_]+)\(', line)
    if match and match.group(2) in funcs_to_move:
        if match.group(1):
            moved_exports.append(match.group(2))
        
        # Ensure it's exported if it needs to be imported by engine
        if match.group(2) == "clanSurname" and not match.group(1):
            line = line.replace("function ", "export function ", 1)
        
        func_lines = [line]
        brace_count = line.count('{') - line.count('}')
        i += 1
        while i < len(lines) and brace_count > 0:
            func_lines.append(lines[i])
            brace_count += lines[i].count('{') - lines[i].count('}')
            i += 1
        
        out_clan.extend(func_lines)
        continue

    out_engine.append(line)
    i += 1

clan_text = "".join(out_clan)
dependencies_to_import = set()
for func in all_funcs_in_engine:
    if func not in funcs_to_move:
        if re.search(r'\b' + func + r'\b', clan_text):
            dependencies_to_import.add(func)

for c in all_consts:
    if re.search(r'\b' + c + r'\b', clan_text):
        dependencies_to_import.add(c)

deps_to_export_now = dependencies_to_import - exported_funcs
engine_exports_add = ''
if deps_to_export_now:
    engine_exports_add = 'export { ' + ', '.join(sorted(deps_to_export_now)) + ' };\r\n'

imports_str = 'import { ' + ', '.join(sorted(dependencies_to_import)) + ' } from "../engine.js";\r\n'
imports_str += 'import { Faction, ClanAttitude } from "../models.js";\r\n'
imports_str += 'import { logLine } from "../log.js";\r\n'


engine_import = 'import { clanSurname, ' + ', '.join(moved_exports) + ' } from "./actions/clan.js";\r\n'
engine_export = 'export { ' + ', '.join(moved_exports) + ' };\r\n'

out_engine.insert(0, engine_import)
out_engine.append("\r\n" + engine_export)
if engine_exports_add:
    out_engine.append("\r\n" + engine_exports_add)

os.makedirs("actions", exist_ok=True)
with open("actions/clan.js", "wb") as f:
    f.write(imports_str.encode("utf-8"))
    f.write("\r\n".encode("utf-8"))
    f.write("".join(out_clan).encode("utf-8"))

with open("engine.js", "wb") as f:
    f.write("".join(out_engine).encode("utf-8"))

