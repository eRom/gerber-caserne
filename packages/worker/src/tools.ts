import { z } from "zod";

// ---------------------------------------------------------------------------
// Web Standards port of packages/mcp/src/tools/rag.ts
// - Buffer.from(b64, 'base64')  -> base64ToUtf8(b64)
// - Buffer.from(s, 'utf-8').toString('base64')  -> utf8ToBase64(s)
// - process.env.X  -> env.X (passed in)
// ---------------------------------------------------------------------------

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// rag
// ---------------------------------------------------------------------------

export const RagInput = z.object({
  question: z.string().min(1).max(500),
  repo: z.string().optional(),
});

export type RagInputType = z.input<typeof RagInput>;

interface Source {
  repo: string;
  path: string;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-flash-latest";
const MAX_SOURCES_FETCH = 10;

async function findStore(apiKey: string, corpusName: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/fileSearchStores?pageSize=20`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(
      `Gemini list stores failed: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    fileSearchStores?: Array<{ name?: string; displayName?: string }>;
  };
  const store = (data.fileSearchStores || []).find(
    (s) => s.displayName === corpusName,
  );
  if (!store?.name) {
    throw new Error(
      `FileSearchStore "${corpusName}" introuvable. La sync vault n'a probablement pas tourne.`,
    );
  }
  return store.name;
}

function extractSources(response: unknown, repoFilter?: string): Source[] {
  const candidates = (
    response as {
      candidates?: Array<{
        groundingMetadata?: { groundingChunks?: unknown[] };
      }>;
    }
  )?.candidates;
  const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const out: Source[] = [];

  for (const chunkRaw of chunks) {
    const chunk = chunkRaw as {
      retrievedContext?: {
        customMetadata?: Array<{ key: string; stringValue?: string }>;
        title?: string;
      };
    };
    const ctx = chunk.retrievedContext;
    if (!ctx) continue;

    let repo: string | undefined;
    let path: string | undefined;
    for (const m of ctx.customMetadata || []) {
      if (m.key === "repo") repo = m.stringValue;
      if (m.key === "path") path = m.stringValue;
    }

    if ((!repo || !path) && typeof ctx.title === "string") {
      const parts = ctx.title.split("|");
      if (parts.length === 4 && parts[0] === "vault") {
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

async function fetchContent(
  githubPat: string,
  repo: string,
  path: string,
): Promise<string> {
  const safePath = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `https://api.github.com/repos/${repo}/contents/${safePath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "gerber-worker/rag",
    },
  });
  if (!res.ok) {
    return `[Fetch failed: ${res.status} ${res.statusText}]`;
  }
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (typeof data.content !== "string") {
    return "[Pas de contenu base64 dans la reponse GitHub]";
  }
  return base64ToUtf8(data.content.replace(/\n/g, ""));
}

export interface RagEnv {
  VAULT_EMBED_API_KEY: string;
  VAULT_CORPUS_NAME: string;
  VAULT_GERBER_PAT: string;
}

export async function ragTool(
  rawInput: RagInputType,
  env: RagEnv,
): Promise<string> {
  const { question, repo } = RagInput.parse(rawInput);

  if (!env.VAULT_EMBED_API_KEY)
    throw new Error("VAULT_EMBED_API_KEY manquante cote Worker.");
  if (!env.VAULT_CORPUS_NAME)
    throw new Error("VAULT_CORPUS_NAME manquante cote Worker.");
  if (!env.VAULT_GERBER_PAT)
    throw new Error("VAULT_GERBER_PAT manquant cote Worker.");

  const storeName = await findStore(
    env.VAULT_EMBED_API_KEY,
    env.VAULT_CORPUS_NAME,
  );

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Liste les documents les plus pertinents pour repondre a : ${question}${
              repo ? ` (filtre repo: ${repo})` : ""
            }`,
          },
        ],
      },
    ],
    tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
    generationConfig: { maxOutputTokens: 1024 },
  };

  const genRes = await fetch(
    `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": env.VAULT_EMBED_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!genRes.ok) {
    throw new Error(
      `Gemini generateContent failed: ${genRes.status} ${await genRes.text()}`,
    );
  }
  const response = await genRes.json();

  const sources = extractSources(response, repo);

  const out: string[] = [];
  out.push("# Vault RAG — resultat\n");
  out.push(`**Question** : ${question}`);
  if (repo) out.push(`**Filtre repo** : \`${repo}\``);
  out.push(`**Sources trouvees** : ${sources.length}\n`);

  if (sources.length === 0) {
    out.push(
      "_Aucun document pertinent trouve dans le vault. Soit la question est hors scope, soit le contenu n'est pas indexe._",
    );
    return out.join("\n");
  }

  out.push("## Sources\n");
  for (const s of sources) out.push(`- \`${s.repo}\` → \`${s.path}\``);
  out.push("");

  out.push("## Contenu integral\n");
  const contents = await Promise.all(
    sources.map((s) => fetchContent(env.VAULT_GERBER_PAT, s.repo, s.path)),
  );

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!;
    const content = contents[i]!;
    const ext = s.path.split(".").pop() || "";
    out.push(`### \`${s.repo}/${s.path}\`\n`);
    out.push("```" + ext);
    out.push(content);
    out.push("```\n");
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// rag_onboard
// ---------------------------------------------------------------------------

const VAULT_REPO = "eRom/gerber-vault";
const SOURCES_PATH = "sources.yml";
const DEFAULT_PATHS = [
  "CLAUDE.md",
  "AGENTS.md",
  "GEMINI.md",
  "README.md",
  "docs/",
  "_gerber_/",
];

export const RagOnboardInput = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"'),
  paths: z.array(z.string()).optional(),
});

export type RagOnboardInputType = z.input<typeof RagOnboardInput>;

interface OnboardResult {
  status: "added" | "already_registered";
  repo: string;
  paths: string[];
  commitSha?: string;
  commitUrl?: string;
}

export interface RagOnboardEnv {
  VAULT_GERBER_HUB: string;
}

export async function ragOnboardTool(
  rawInput: RagOnboardInputType,
  env: RagOnboardEnv,
): Promise<OnboardResult> {
  const { repo, paths } = RagOnboardInput.parse(rawInput);
  const finalPaths = paths && paths.length > 0 ? paths : DEFAULT_PATHS;

  if (!env.VAULT_GERBER_HUB) {
    throw new Error("VAULT_GERBER_HUB manquant cote Worker.");
  }

  const ghHeaders = {
    Authorization: `Bearer ${env.VAULT_GERBER_HUB}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gerber-worker/rag-onboard",
  };

  const getUrl = `https://api.github.com/repos/${VAULT_REPO}/contents/${SOURCES_PATH}`;
  const getRes = await fetch(getUrl, { headers: ghHeaders });
  if (!getRes.ok) {
    throw new Error(
      `GET sources.yml failed: ${getRes.status} ${await getRes.text()}`,
    );
  }
  const getData = (await getRes.json()) as { content?: string; sha?: string };
  if (!getData.content || !getData.sha) {
    throw new Error("sources.yml introuvable ou format inattendu cote GitHub");
  }
  const currentContent = base64ToUtf8(getData.content.replace(/\n/g, ""));

  const idempotenceRe = new RegExp(
    `^\\s*-\\s*repo:\\s*${repo.replace(/[.+*?^$(){}[\]\\|]/g, "\\$&")}\\s*$`,
    "m",
  );
  if (idempotenceRe.test(currentContent)) {
    return {
      status: "already_registered",
      repo,
      paths: finalPaths,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const yamlBlock = [
    `  - repo: ${repo}`,
    `    paths:`,
    ...finalPaths.map((p) => `      - ${p}`),
    `    added: ${today}`,
    "",
  ].join("\n");

  const newContent =
    (currentContent.endsWith("\n") ? currentContent : currentContent + "\n") +
    yamlBlock;

  const putRes = await fetch(getUrl, {
    method: "PUT",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `vault: register ${repo} via rag_onboard`,
      content: utf8ToBase64(newContent),
      sha: getData.sha,
      branch: "main",
    }),
  });
  if (!putRes.ok) {
    throw new Error(
      `PUT sources.yml failed: ${putRes.status} ${await putRes.text()}`,
    );
  }
  const putData = (await putRes.json()) as {
    commit?: { sha?: string; html_url?: string };
  };

  const result: OnboardResult = {
    status: "added",
    repo,
    paths: finalPaths,
  };
  if (putData.commit?.sha !== undefined) result.commitSha = putData.commit.sha;
  if (putData.commit?.html_url !== undefined)
    result.commitUrl = putData.commit.html_url;
  return result;
}
