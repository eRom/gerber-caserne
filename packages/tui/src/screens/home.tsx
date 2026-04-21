import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "../components/spinner.js";
import { StatusBadge } from "../components/status-badge.js";
import { useData } from "../hooks/use-data.js";
import { getStats } from "../api/maintenance.js";
import { listProjects } from "../api/projects.js";
import { listMessages, updateMessage } from "../api/messages.js";
import { listHandoffs } from "../api/handoffs.js";
import { GLOBAL_PROJECT_ID } from "@agent-brain/shared";
import type { Stats, Project, Message, Handoff } from "@agent-brain/shared";

export interface ActiveProject {
  id: string;
  slug: string;
  name: string;
  color?: string | undefined;
  repoPath?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

type Focus = "projects" | "messages";

interface HomeProps {
  onOpenProject: (project: ActiveProject) => void;
}

export function Home({ onOpenProject }: HomeProps) {
  const [focus, setFocus] = useState<Focus>("projects");
  const [projIdx, setProjIdx] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  const stats = useData<Stats>(() => getStats());
  const projects = useData(() => listProjects({ limit: 50 }));
  const messages = useData(() =>
    listMessages({ status: "pending", limit: 20 }),
  );
  const handoffs = useData(() => listHandoffs({ status: "inbox", limit: 20 }));

  const projItems = (projects.data?.items ?? [])
    .filter((p) => p.id !== GLOBAL_PROJECT_ID)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const msgItems = messages.data?.items ?? [];

  const GRID_COLS = 4;
  const projRows: Project[][] = [];
  for (let i = 0; i < projItems.length; i += GRID_COLS) {
    projRows.push(projItems.slice(i, i + GRID_COLS));
  }

  const markDone = useCallback(async () => {
    const msg = msgItems[msgIdx];
    if (!msg || msg.status === "done") return;
    await updateMessage({ id: msg.id, status: "done" });
    messages.refetch();
  }, [msgItems, msgIdx, messages]);

  useInput((input, key) => {
    // Tab to switch focus between columns
    if (key.tab) {
      setFocus((f) => (f === "projects" ? "messages" : "projects"));
      return;
    }

    if (focus === "projects") {
      if (key.leftArrow) setProjIdx((s) => Math.max(0, s - 1));
      if (key.rightArrow)
        setProjIdx((s) => Math.min(projItems.length - 1, s + 1));
      if (key.upArrow) setProjIdx((s) => Math.max(0, s - GRID_COLS));
      if (key.downArrow)
        setProjIdx((s) => Math.min(projItems.length - 1, s + GRID_COLS));
      if (key.return) {
        const proj = projItems[projIdx];
        if (proj)
          onOpenProject({
            id: proj.id,
            slug: proj.slug,
            name: proj.name,
            color: proj.color ?? undefined,
            repoPath: proj.repoPath ?? null,
          });
      }
    }

    if (focus === "messages") {
      if (key.upArrow) setMsgIdx((s) => Math.max(0, s - 1));
      if (key.downArrow) setMsgIdx((s) => Math.min(msgItems.length - 1, s + 1));
      if (key.return || input === "x") void markDone();
    }

    if (input === "r") {
      stats.refetch();
      projects.refetch();
      messages.refetch();
      handoffs.refetch();
    }
  });

  const handoffItems = handoffs.data?.items ?? [];

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* ─── Overview ─── */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          --- Overview{" "}
        </Text>
      </Box>

      {stats.loading ? (
        <Spinner label="Loading stats..." />
      ) : stats.error ? (
        <Text color="red">Error: {stats.error.message}</Text>
      ) : (
        <Box gap={4} marginBottom={1}>
          <Box flexDirection="column">
            <Text dimColor>Notes</Text>
            <Text bold>{stats.data!.notes.total}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Chunks</Text>
            <Text bold>{stats.data!.chunks.total}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Embeddings</Text>
            <Text bold>{stats.data!.embeddings.total}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>DB Size</Text>
            <Text bold>{formatBytes(stats.data!.dbSizeBytes)}</Text>
          </Box>
        </Box>
      )}

      {/* ─── Projects grid (4 columns, alpha-sorted) ─── */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Text
            bold
            {...(focus === "projects"
              ? { color: "cyan" }
              : { dimColor: true })}
          >
            --- Projects
          </Text>
        </Box>

        {projects.loading ? (
          <Spinner label="Loading projects..." />
        ) : projItems.length === 0 ? (
          <Text dimColor italic>
            {" "}
            No projects
          </Text>
        ) : (
          projRows.map((row, rowIdx) => (
            <Box key={rowIdx} flexDirection="row">
              {row.map((proj: Project, colIdx: number) => {
                const i = rowIdx * GRID_COLS + colIdx;
                const selected = focus === "projects" && projIdx === i;
                return (
                  <Box key={proj.id} width="25%">
                    {selected ? (
                      <Text color="cyan" bold>
                        {"> "}
                      </Text>
                    ) : (
                      <Text>{"  "}</Text>
                    )}
                    {proj.isRunning ? (
                      <Text color="green">● </Text>
                    ) : (
                      <Text>  </Text>
                    )}
                    <Text {...(selected ? { bold: true } : {})}>
                      {proj.slug}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          ))
        )}
      </Box>

      {/* ─── Messages (list below) ─── */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text
            bold
            {...(focus === "messages"
              ? { color: "cyan" }
              : { dimColor: true })}
          >
            --- Messages
          </Text>
          {messages.data && (
            <Text dimColor> ({messages.data.pendingCount} pending)</Text>
          )}
        </Box>

        {messages.loading ? (
          <Spinner label="Loading messages..." />
        ) : msgItems.length === 0 ? (
          <Text dimColor italic>
            {" "}
            No pending messages
          </Text>
        ) : (
          msgItems.map((msg: Message, i: number) => {
            const isSelected = focus === "messages" && msgIdx === i;
            return (
              <Box
                key={msg.id}
                flexDirection="column"
                {...(isSelected ? { marginBottom: 1 } : {})}
              >
                <Box>
                  {isSelected ? (
                    <Text color="cyan" bold>
                      {"> "}
                    </Text>
                  ) : (
                    <Text>{"  "}</Text>
                  )}
                  <StatusBadge type="message" value={msg.status} />
                  <Text> </Text>
                  <Text bold>
                    {msg.title.slice(0, 50)}
                    {msg.title.length > 50 ? "..." : ""}
                  </Text>
                  <Text dimColor> ({msg.type})</Text>
                </Box>
                {isSelected && (
                  <Box paddingLeft={4}>
                    <Text wrap="wrap">
                      {msg.content.slice(0, 200)}
                      {msg.content.length > 200 ? "..." : ""}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* ─── Handoffs (read-only list, inbox only) ─── */}
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Text bold dimColor>
            --- Handoffs
          </Text>
          {handoffs.data && (
            <Text dimColor> ({handoffItems.length} inbox)</Text>
          )}
        </Box>

        {handoffs.loading ? (
          <Spinner label="Loading handoffs..." />
        ) : handoffItems.length === 0 ? (
          <Text dimColor italic>
            {" "}
            No pending handoffs
          </Text>
        ) : (
          handoffItems.map((h: Handoff) => (
            <Box key={h.id}>
              <Text>{"  "}</Text>
              <Text bold>
                {h.title.slice(0, 60)}
                {h.title.length > 60 ? "..." : ""}
              </Text>
              <Text dimColor> {formatAgo(h.createdAt)}</Text>
            </Box>
          ))
        )}
      </Box>

      {/* Help bar */}
      <Box marginTop={1}>
        <Text dimColor>
          Tab switch focus | {focus === "projects" ? "←→↑↓" : "↑↓"} navigate |
          Enter open
          {focus === "messages" ? "/mark done" : ""} | [r] refresh
        </Text>
      </Box>
    </Box>
  );
}
