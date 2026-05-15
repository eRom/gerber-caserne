#!/usr/bin/env bun
/**
 * docs-rag skill — script principal
 *
 * 1. Query le vault Gemini (FileSearchStore) en mode agent (sources seules)
 * 2. Fetch le contenu brut de chaque doc cité depuis GitHub via `gh api`
 * 3. Print un Markdown structuré pour que l'agent appelant synthétise
 *
 * Zéro dépendance npm : REST API Gemini + gh CLI seulement.
 *
 * Usage : bun run query-rag.ts "<question>" [--repo owner/name]
 *
 * Env requis :
 *   - VAULT_EMBED_API_KEY  : clé Gemini API
 *   - VAULT_CORPUS_NAME    : displayName du FileSearchStore
 */

const apiKey = process.env.VAULT_EMBED_API_KEY;
const corpusName = process.env.VAULT_CORPUS_NAME;

if (!apiKey) {
  console.error("🚨 VAULT_EMBED_API_KEY manquante.");
  process.exit(1);
}
if (!corpusName) {
  console.error("🚨 VAULT_CORPUS_NAME manquant.");
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const repoFilter = (() => {
  const idx = rawArgs.indexOf("--repo");
  return idx >= 0 ? rawArgs[idx + 1] : undefined;
})();
const question = rawArgs
  .filter((a, i, arr) => {
    if (a === "--repo") return false;
    if (i > 0 && arr[i - 1] === "--repo") return false;
    return true;
  })
  .join(" ");

if (!question) {
  console.error(
    "Utilisation : bun run query-rag.ts '<question>' [--repo owner/name]",
  );
  process.exit(1);
}

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const headers = {
  "x-goog-api-key": apiKey,
  "Content-Type": "application/json",
};

/** Résout le FileSearchStore par son displayName. */
async function findStore(): Promise<string> {
  const res = await fetch(`${API_BASE}/fileSearchStores?pageSize=20`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`List stores failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { fileSearchStores?: any[] };
  const store = (data.fileSearchStores || []).find(
    (s: any) => s.displayName === corpusName,
  );
  if (!store) {
    throw new Error(
      `FileSearchStore "${corpusName}" introuvable. Lance d'abord la sync.`,
    );
  }
  return store.name;
}

interface Source {
  repo: string;
  path: string;
}

/** Extrait { repo, path } des groundingChunks via customMetadata. */
function extractSources(response: any): Source[] {
  const chunks =
    response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const out: Source[] = [];

  for (const chunk of chunks) {
    const ctx = chunk.retrievedContext;
    if (!ctx) continue;

    let repo: string | undefined;
    let path: string | undefined;
    for (const m of ctx.customMetadata || []) {
      if (m.key === "repo") repo = m.stringValue;
      if (m.key === "path") path = m.stringValue;
    }

    // Fallback legacy : parse displayName "vault|corpus|repo|path"
    if ((!repo || !path) && typeof ctx.title === "string") {
      const parts = ctx.title.split("|");
      if (parts.length === 4 && parts[0] === "vault") {
        repo = repo || parts[2];
        path = path || parts[3];
      }
    }

    if (!repo || !path) continue;
    const key = `${repo}|${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ repo, path });
  }
  return out;
}

/** Fetch raw content of a file via gh CLI (gère les repos privés). */
async function fetchContent(repo: string, path: string): Promise<string> {
  const proc = Bun.spawnSync({
    cmd: ["gh", "api", `repos/${repo}/contents/${path}`],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    const err = new TextDecoder().decode(proc.stderr);
    return `[Fetch failed: ${err.trim() || `exit ${proc.exitCode}`}]`;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(proc.stdout));
    if (typeof data.content !== "string") {
      return `[Pas de contenu base64 dans la réponse GitHub]`;
    }
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch (e: any) {
    return `[Parse error: ${e.message}]`;
  }
}

async function main() {
  // Étape 1 — Query RAG en mode agent (sources seules, prompt court)
  const storeName = await findStore();

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Liste les documents les plus pertinents pour répondre à : ${question}${repoFilter ? ` (filtre repo: ${repoFilter})` : ""}`,
          },
        ],
      },
    ],
    tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
    // 1024 minimum : en-dessous, le modèle s'arrête avant de déclencher
    // le tool fileSearch et la réponse est vide de groundingChunks.
    generationConfig: { maxOutputTokens: 1024 },
  };

  // gemini-flash-latest = alias officiel Google vers Gemini 3 Flash.
  // Plus stable que d'épingler "gemini-3-flash-preview" qui peut être renommé.
  const res = await fetch(
    `${API_BASE}/models/gemini-flash-latest:generateContent`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    throw new Error(
      `generateContent failed: ${res.status} ${await res.text()}`,
    );
  }
  const response = await res.json();

  let sources = extractSources(response);
  if (repoFilter) sources = sources.filter((s) => s.repo === repoFilter);

  // Étape 2 — Output Markdown structuré
  console.log(`# Vault RAG — résultat\n`);
  console.log(`**Question** : ${question}`);
  if (repoFilter) console.log(`**Filtre repo** : \`${repoFilter}\``);
  console.log(`**Sources trouvées** : ${sources.length}\n`);

  if (sources.length === 0) {
    console.log(
      "_Aucun document pertinent trouvé dans le vault. Soit la question est hors scope, soit le contenu n'est pas indexé._",
    );
    return;
  }

  console.log("## Sources\n");
  for (const s of sources) {
    console.log(`- \`${s.repo}\` → \`${s.path}\``);
  }
  console.log();

  // Étape 3 — Fetch parallèle + contenu intégral
  console.log("## Contenu intégral\n");
  const contents = await Promise.all(
    sources.map((s) => fetchContent(s.repo, s.path)),
  );

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const content = contents[i];
    const ext = s.path.split(".").pop() || "";
    console.log(`### \`${s.repo}/${s.path}\`\n`);
    console.log("```" + ext);
    console.log(content);
    console.log("```\n");
  }
}

main().catch((err) => {
  console.error("🚨 Erreur :", err.message || err);
  process.exit(1);
});
