#!/bin/bash
# gerber inbox check (startup)
AGENT_BRAIN="http://127.0.0.1:4000/mcp"
SLUG_FILE="$PWD/.gerber-slug"
[ -f "$SLUG_FILE" ] || exit 0
PROJECT_SLUG=$(head -1 "$SLUG_FILE" | tr -d '[:space:]')
[ -n "$PROJECT_SLUG" ] || exit 0

# Check si gerber tourne (timeout 1s, silencieux si down)
if ! /usr/bin/curl -s --connect-timeout 1 "http://127.0.0.1:4000/health" > /dev/null 2>&1; then
  exit 0
fi

# Poll messages pending
MSG_RESULT=$(/usr/bin/curl -s -X POST "$AGENT_BRAIN" \
  -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"message_list\",\"params\":{\"projectSlug\":\"$PROJECT_SLUG\",\"status\":\"pending\"}}" 2>/dev/null)

# Poll tasks inbox
TASK_RESULT=$(/usr/bin/curl -s -X POST "$AGENT_BRAIN" \
  -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"task_list\",\"params\":{\"projectSlug\":\"$PROJECT_SLUG\",\"status\":\"inbox\"}}" 2>/dev/null)

# Poll issues inbox
ISSUE_RESULT=$(/usr/bin/curl -s -X POST "$AGENT_BRAIN" \
  -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"issue_list\",\"params\":{\"projectSlug\":\"$PROJECT_SLUG\",\"status\":\"inbox\"}}" 2>/dev/null)

OUTPUT=$(python3 -c "
import sys, json

lines = []

# Messages
try:
    r = json.loads('''$MSG_RESULT''').get('result', {})
    count = r.get('pendingCount', 0)
    if count > 0:
        lines.append(f'gerber: {count} message(s) en attente')
        for m in r.get('items', []):
            icon = {'context':'i','reminder':'R'}.get(m['type'],'?')
            src = m.get('metadata',{}).get('sourceProject','')
            src_str = f' (from {src})' if src else ''
            lines.append(f'  [{icon}] {m[\"title\"]}{src_str}')
except: pass

# Tasks inbox
try:
    r = json.loads('''$TASK_RESULT''').get('result', {})
    total = r.get('total', 0)
    if total > 0:
        lines.append(f'gerber: {total} tache(s) en inbox')
        for t in r.get('items', [])[:5]:
            prio = f' [{t[\"priority\"]}]' if t['priority'] != 'normal' else ''
            lines.append(f'  [T]{prio} {t[\"title\"]}')
        if total > 5:
            lines.append(f'  ... et {total - 5} autres')
except: pass

# Issues inbox
try:
    r = json.loads('''$ISSUE_RESULT''').get('result', {})
    total = r.get('total', 0)
    if total > 0:
        lines.append(f'gerber: {total} issue(s) en inbox')
        for i in r.get('items', [])[:5]:
            sev = i.get('severity', 'bug')
            prio = f' [{i[\"priority\"]}]' if i['priority'] != 'normal' else ''
            lines.append(f'  [{sev}]{prio} {i[\"title\"]}')
        if total > 5:
            lines.append(f'  ... et {total - 5} autres')
except: pass

if lines:
    print('\n'.join(lines))
    print('Tape /gerber:inbox, /gerber:task ou /gerber:issue pour gerer.')
" 2>/dev/null)

if [ -n "$OUTPUT" ]; then
  echo "$OUTPUT"
fi
