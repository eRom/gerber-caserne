#!/bin/bash
# gerber inbox check (startup) — remote MCP via HTTPS + bearer.
# Silently skips if GERBER_TOKEN is unset or the server is unreachable.
# Polls pending messages only — tasks/issues live in Linear since 2026-05-17.

GERBER_URL="${GERBER_URL:-https://gerber.mcp.romain-ecarnot.com}"
SLUG_FILE="$PWD/.cave/.gerber-slug"

[ -f "$SLUG_FILE" ] || exit 0
PROJECT_SLUG=$(head -1 "$SLUG_FILE" | tr -d '[:space:]')
[ -n "$PROJECT_SLUG" ] || exit 0

# No token configured (user not onboarded yet) -> silent skip
[ -n "$GERBER_TOKEN" ] || exit 0

# Reachability probe (timeout 2s, silent if down)
if ! /usr/bin/curl -fsS --connect-timeout 2 \
     -H "Authorization: Bearer $GERBER_TOKEN" \
     "$GERBER_URL/health" > /dev/null 2>&1; then
  exit 0
fi

AUTH_HDR="Authorization: Bearer $GERBER_TOKEN"
CONTENT_HDR="Content-Type: application/json"

# Poll messages pending
MSG_RESULT=$(/usr/bin/curl -sS -X POST "$GERBER_URL/mcp" \
  -H "$AUTH_HDR" -H "$CONTENT_HDR" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"message_list\",\"params\":{\"projectSlug\":\"$PROJECT_SLUG\",\"status\":\"pending\"}}" 2>/dev/null)

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

if lines:
    print('\n'.join(lines))
    print('Tape /gerber:inbox pour gerer.')
" 2>/dev/null)

if [ -n "$OUTPUT" ]; then
  echo "$OUTPUT"
fi
