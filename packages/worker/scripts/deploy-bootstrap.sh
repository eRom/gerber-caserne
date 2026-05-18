#!/usr/bin/env bash
# One-shot bootstrap : KV create + 7 secrets + first deploy.
# Idempotent on the KV step (reuses existing if found).
# Reads secrets from ~/.config/gerber/config.json and packages/.env -- never
# echoes their values.

set -euo pipefail

WORKER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORKER_DIR"

CFG="$HOME/.config/gerber/config.json"
ENV_FILE="$(cd .. && pwd)/.env"

# --- 0. Prerequisites -------------------------------------------------------
[ -f "$CFG" ] || { echo "[err] missing $CFG"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "[err] missing $ENV_FILE"; exit 1; }

if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "[err] not logged in to wrangler. run: npx wrangler login"
  exit 1
fi

# --- 1. KV namespace --------------------------------------------------------
echo "[step] creating OAUTH_KV namespace (or reusing existing)..."
KV_OUTPUT=$(npx wrangler kv namespace create OAUTH_KV 2>&1 || true)
if echo "$KV_OUTPUT" | grep -qiE "already (exists|in use)"; then
  echo "[info] already exists, fetching id..."
  KV_ID=$(npx wrangler kv namespace list 2>/dev/null \
    | node -e 'const ns=JSON.parse(require("fs").readFileSync(0,"utf8"));const m=ns.find(n=>n.title==="gerber-mcp-OAUTH_KV"||n.title==="OAUTH_KV");if(m)console.log(m.id)')
else
  KV_ID=$(echo "$KV_OUTPUT" \
    | node -e 'const t=require("fs").readFileSync(0,"utf8");const m=t.match(/id\s*=\s*"([^"]+)"/);if(m)console.log(m[1])')
fi

if [ -z "${KV_ID:-}" ]; then
  echo "[err] failed to resolve KV id. wrangler output:"
  echo "$KV_OUTPUT"
  exit 1
fi
echo "[info] KV_ID=${KV_ID}"

# --- 2. Patch wrangler.toml -------------------------------------------------
if grep -q 'REPLACE_WITH_KV_ID' wrangler.toml; then
  sed -i.bak "s/REPLACE_WITH_KV_ID/${KV_ID}/" wrangler.toml
  rm -f wrangler.toml.bak
  echo "[ok] patched wrangler.toml"
else
  echo "[info] wrangler.toml already has a KV id"
fi

# --- 3. Helper --------------------------------------------------------------
put_secret() {
  local NAME=$1
  local VALUE=$2
  if [ -z "$VALUE" ]; then
    echo "[skip] empty value for ${NAME}"
    return
  fi
  printf '%s' "$VALUE" | npx wrangler secret put "$NAME" >/dev/null 2>&1
  echo "[ok] ${NAME}"
}

# --- 4. Secrets from ~/.config/gerber/config.json ---------------------------
echo "[step] reading ${CFG}..."
STREAM_TOKEN_VAL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.config/gerber/config.json","utf8")).streamToken||"")')
CLIENT_ID_VAL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.config/gerber/config.json","utf8")).oauthClientId||"")')
CLIENT_SECRET_VAL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.config/gerber/config.json","utf8")).oauthClientSecret||"")')

echo "[step] putting OAuth + bearer secrets..."
put_secret STREAM_TOKEN "$STREAM_TOKEN_VAL"
put_secret OAUTH_CLIENT_ID "$CLIENT_ID_VAL"
put_secret OAUTH_CLIENT_SECRET "$CLIENT_SECRET_VAL"

# --- 5. Secrets from packages/.env ------------------------------------------
echo "[step] reading ${ENV_FILE}..."
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "[step] putting Gemini + GitHub secrets..."
put_secret VAULT_EMBED_API_KEY "${VAULT_EMBED_API_KEY:-}"
put_secret VAULT_CORPUS_NAME "${VAULT_CORPUS_NAME:-}"
put_secret VAULT_GERBER_PAT "${VAULT_GERBER_PAT:-}"
put_secret VAULT_GERBER_HUB "${VAULT_GERBER_HUB:-}"

# --- 6. Deploy --------------------------------------------------------------
echo "[step] deploying..."
npx wrangler deploy

echo ""
echo "[done] deploy ok"
echo ""
echo "next: map custom domain gerber.mcp.romain-ecarnot.com to the worker."
echo "  fastest path: dashboard.cloudflare.com -> Workers & Pages -> gerber-mcp"
echo "                -> Settings -> Domains & Routes -> Add Custom Domain"
