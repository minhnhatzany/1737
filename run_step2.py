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
    content = f.read().decode("utf-8")

# Parse functions
lines = content.splitlines(keepends=True)
out_engine = []
out_clan = []

# Assuming functions are defined with `function name(` or `export function name(`
# We need to capture the whole function block.
# Since JavaScript functions can span multiple lines and have nested braces,
# we can use a stack to track braces.

i = 0
moved_exports = []
while i < len(lines):
    line = lines[i]
    match = re.match(r'^(export )?function ([a-zA-Z0-9_]+)\(', line)
    if match and match.group(2) in funcs_to_move:
        if match.group(1):
            moved_exports.append(match.group(2))
        
        # We found a function to move. Read until brace count matches.
        func_lines = [line]
        # Count braces in the first line
        brace_count = line.count('{') - line.count('}')
        i += 1
        while i < len(lines) and brace_count > 0:
            func_lines.append(lines[i])
            brace_count += lines[i].count('{') - lines[i].count('}')
            i += 1
        
        out_clan.extend(func_lines)
        out_clan.append("\r\n") # add blank line between functions
        continue

    out_engine.append(line)
    i += 1

engine_content = "".join(out_engine)

# Figure out dependencies to import in actions/clan.js
# Just naive parsing for commonly needed from models/events, or we can just import from engine.js for now.
# Wait, the spec says "Import ngược từ engine.js hoặc từ module gốc".
# Let's import everything from engine and models.

clan_imports = 'import { logLine, randInt, rng, clamp, getHuyenControl, getAllRegions, setHuyenControl, getRegion, getHuyenGarrisonTroops } from "../engine.js";\r\n'
clan_imports += 'import { Faction, RegionId } from "../models.js";\r\n\r\n' # just some generic ones in case

# Let's actually find what they use
uses_state = True # they all use state
clan_content = "".join(out_clan)

# Write to actions/clan.js
os.makedirs("actions", exist_ok=True)
with open("actions/clan.js", "wb") as f:
    # Let's import clanSurname in engine.js
    pass

# We should rather do it carefully.
