import { z } from 'zod';

// ---------------------------------------------------------------------------
// rag — RAG cross-projets via vault Gemini + fetch GitHub
//
// 1. Query le FileSearchStore Gemini (REST, prompt court, maxOutputTokens=1024)
// 2. Extrait les sources des groundingChunks.retrievedContext.customMetadata
// 3. Fetch chaque doc cité via GitHub REST API (gère les repos privés)
// 4. Retourne un Markdown structuré (sources + contenu intégral)
//
// Env requis côté serveur :
//   - VAULT_EMBED_API_KEY : clé Gemini API
//   - VAULT_CORPUS_NAME   : displayName du FileSearchStore
//   - VAULT_GERBER_PAT    : PAT GitHub fine-grained, scope Contents:read (pour les privés)
// ---------------------------------------------------------------------------

const RagInput = z.object({
  question: z.string().min(1).max(500),
  repo: z.string().optional(),
});

export type RagInputType = z.input<typeof RagInput>;

interface Source {
  repo: string;
  path: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// gemini-flash-latest = alias officiel Google vers Gemini 3 Flash.
// Plus stable que d'épingler "gemini-3-flash-preview" qui peut être renommé.
const GEMINI_MODEL = 'gemini-flash-latest';
const MAX_SOURCES_FETCH = 10;

async function findStore(apiKey: string, corpusName: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/fileSearchStores?pageSize=20`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`Gemini list stores failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { fileSearchStores?: Array<{ name?: string; displayName?: string }> };
  const store = (data.fileSearchStores || []).find((s) => s.displayName === corpusName);
  if (!store?.name) {
    throw new Error(
      `FileSearchStore "${corpusName}" introuvable. La sync vault n'a probablement pas tourné.`,
    );
  }
  return store.name;
}

function extractSources(response: unknown, repoFilter?: string): Source[] {
  const candidates = (response as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: unknown[] } }> })?.candidates;
  const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const out: Source[] = [];

  for (const chunkRaw of chunks) {
    const chunk = chunkRaw as { retrievedContext?: { customMetadata?: Array<{ key: string; stringValue?: string }>; title?: string } };
    const ctx = chunk.retrievedContext;
    if (!ctx) continue;

    let repo: string | undefined;
    let path: string | undefined;
    for (const m of ctx.customMetadata || []) {
      if (m.key === 'repo') repo = m.stringValue;
      if (m.key === 'path') path = m.stringValue;
    }

    // Fallback legacy : parse displayName "vault|corpus|repo|path"
    if ((!repo || !path) && typeof ctx.title === 'string') {
      const parts = ctx.title.split('|');
      if (parts.length === 4 && parts[0] === 'vault') {
        repo = repo || parts[2];
        path = path || parts[3];
      }
    }

    if (!repo || !path) continue;
    if (repoFilter && repo !== repoFilter) continue;
    const key = `${repo}|${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ repo, path });
    if (out.length >= MAX_SOURCES_FETCH) break;
  }
  return out;
}

async function fetchContent(githubPat: string, repo: string, path: string): Promise<string> {
  // GitHub Contents API : path doit être URL-encodé segment par segment
  const safePath = path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `https://api.github.com/repos/${repo}/contents/${safePath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gerber-mcp/rag',
    },
  });
  if (!res.ok) {
    return `[Fetch failed: ${res.status} ${res.statusText}]`;
  }
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (typeof data.content !== 'string') {
    return '[Pas de contenu base64 dans la réponse GitHub]';
  }
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function ragTool(rawInput: RagInputType): Promise<string> {
  const { question, repo } = RagInput.parse(rawInput);

  const apiKey = process.env.VAULT_EMBED_API_KEY;
  const corpusName = process.env.VAULT_CORPUS_NAME;
  const githubPat = process.env.VAULT_GERBER_PAT;

  if (!apiKey) throw new Error('VAULT_EMBED_API_KEY manquante côté serveur MCP.');
  if (!corpusName) throw new Error('VAULT_CORPUS_NAME manquante côté serveur MCP.');
  if (!githubPat) throw new Error('VAULT_GERBER_PAT manquant côté serveur MCP.');

  // 1. Résolution du store
  const storeName = await findStore(apiKey, corpusName);

  // 2. Query RAG (prompt court, génération minimale — on veut juste les groundingChunks)
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Liste les documents les plus pertinents pour répondre à : ${question}${repo ? ` (filtre repo: ${repo})` : ''}`,
          },
        ],
      },
    ],
    tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
    // 1024 minimum : en-dessous, le modèle s'arrête avant de déclencher le tool fileSearch
    generationConfig: { maxOutputTokens: 1024 },
  };

  const genRes = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!genRes.ok) {
    throw new Error(`Gemini generateContent failed: ${genRes.status} ${await genRes.text()}`);
  }
  const response = await genRes.json();

  const sources = extractSources(response, repo);

  // 3. Build Markdown
  const out: string[] = [];
  out.push('# Vault RAG — résultat\n');
  out.push(`**Question** : ${question}`);
  if (repo) out.push(`**Filtre repo** : \`${repo}\``);
  out.push(`**Sources trouvées** : ${sources.length}\n`);

  if (sources.length === 0) {
    out.push(
      "_Aucun document pertinent trouvé dans le vault. Soit la question est hors scope, soit le contenu n'est pas indexé._",
    );
    return out.join('\n');
  }

  out.push('## Sources\n');
  for (const s of sources) out.push(`- \`${s.repo}\` → \`${s.path}\``);
  out.push('');

  // 4. Fetch parallèle des contenus
  out.push('## Contenu intégral\n');
  const contents = await Promise.all(
    sources.map((s) => fetchContent(githubPat, s.repo, s.path)),
  );

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!;
    const content = contents[i]!;
    const ext = s.path.split('.').pop() || '';
    out.push(`### \`${s.repo}/${s.path}\`\n`);
    out.push('```' + ext);
    out.push(content);
    out.push('```\n');
  }

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// rag_onboard — enregistre un satellite dans eRom/gerber-vault/sources.yml
//
// 1. GET le sources.yml courant via GitHub Contents API
// 2. Vérifie idempotence (regex : ligne "- repo: owner/name" exacte)
// 3. Append le bloc YAML formaté avec paths défaut (ou custom)
// 4. PUT le nouveau contenu en commitant directement sur main
//
// Env requis : GERBER_VAULT_HUB (PAT Contents:RW sur eRom/gerber-vault)
// ---------------------------------------------------------------------------

const VAULT_REPO = 'eRom/gerber-vault';
const SOURCES_PATH = 'sources.yml';
const DEFAULT_PATHS = [
  'CLAUDE.md',
  'AGENTS.md',
  'GEMINI.md',
  'README.md',
  'docs/',
  '.cave/',
];

const RagOnboardInput = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"'),
  paths: z.array(z.string()).optional(),
});

export type RagOnboardInputType = z.input<typeof RagOnboardInput>;

interface OnboardResult {
  status: 'added' | 'already_registered';
  repo: string;
  paths: string[];
  commitSha?: string;
  commitUrl?: string;
}

export async function ragOnboardTool(rawInput: RagOnboardInputType): Promise<OnboardResult> {
  const { repo, paths } = RagOnboardInput.parse(rawInput);
  const finalPaths = paths && paths.length > 0 ? paths : DEFAULT_PATHS;

  const token = process.env.GERBER_VAULT_HUB;
  if (!token) {
    throw new Error('GERBER_VAULT_HUB manquant côté serveur MCP.');
  }

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gerber-mcp/rag-onboard',
  };

  // 1. GET sources.yml courant
  const getUrl = `https://api.github.com/repos/${VAULT_REPO}/contents/${SOURCES_PATH}`;
  const getRes = await fetch(getUrl, { headers: ghHeaders });
  if (!getRes.ok) {
    throw new Error(`GET sources.yml failed: ${getRes.status} ${await getRes.text()}`);
  }
  const getData = (await getRes.json()) as { content?: string; sha?: string };
  if (!getData.content || !getData.sha) {
    throw new Error('sources.yml introuvable ou format inattendu côté GitHub');
  }
  const currentContent = Buffer.from(getData.content, 'base64').toString('utf-8');

  // 2. Idempotence : ligne "- repo: owner/name" exacte (whitespace-tolerant)
  const idempotenceRe = new RegExp(
    `^\\s*-\\s*repo:\\s*${repo.replace(/[.+*?^$(){}[\]\\|]/g, '\\$&')}\\s*$`,
    'm',
  );
  if (idempotenceRe.test(currentContent)) {
    return {
      status: 'already_registered',
      repo,
      paths: finalPaths,
    };
  }

  // 3. Append le bloc YAML formaté
  const today = new Date().toISOString().slice(0, 10);
  const yamlBlock = [
    `  - repo: ${repo}`,
    `    paths:`,
    ...finalPaths.map((p) => `      - ${p}`),
    `    added: ${today}`,
    '',
  ].join('\n');

  // Garantir un \n final avant l'append (sécurité format)
  const newContent =
    (currentContent.endsWith('\n') ? currentContent : currentContent + '\n') + yamlBlock;

  // 4. PUT contents (commit direct sur main)
  const putRes = await fetch(getUrl, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `vault: register ${repo} via rag_onboard`,
      content: Buffer.from(newContent, 'utf-8').toString('base64'),
      sha: getData.sha,
      branch: 'main',
    }),
  });
  if (!putRes.ok) {
    throw new Error(`PUT sources.yml failed: ${putRes.status} ${await putRes.text()}`);
  }
  const putData = (await putRes.json()) as {
    commit?: { sha?: string; html_url?: string };
  };

  return {
    status: 'added',
    repo,
    paths: finalPaths,
    commitSha: putData.commit?.sha,
    commitUrl: putData.commit?.html_url,
  };
}
