import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "../components/spinner.js";
import { StatusBadge } from "../components/status-badge.js";
import { useData } from "../hooks/use-data.js";
import { getStats } from "../api/maintenance.js";
import { listProjects } from "../api/projects.js";
import { listMessages, updateMessage } from "../api/messages.js";
import type { Stats, Project, Message } from "@agent-brain/shared";

export interface ActiveProject {
  id: string;
  slug: string;
  name: string;
  color?: string | undefined;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const projItems = projects.data?.items ?? [];
  const msgItems = messages.data?.items ?? [];

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
      if (key.upArrow) setProjIdx((s) => Math.max(0, s - 1));
      if (key.downArrow)
        setProjIdx((s) => Math.min(projItems.length - 1, s + 1));
      if (key.return) {
        const proj = projItems[projIdx];
        if (proj)
          onOpenProject({
            id: proj.id,
            slug: proj.slug,
            name: proj.name,
            color: proj.color ?? undefined,
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
    }
  });

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

      {/* ─── Two columns: Projects | Messages ─── */}
      <Box>
        {/* Left column: Projects */}
        <Box flexDirection="column" width="30%">
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
            projItems.map((proj: Project, i: number) => (
              <Box key={proj.id}>
                {focus === "projects" && projIdx === i ? (
                  <Text color="cyan" bold>
                    {"> "}
                  </Text>
                ) : (
                  <Text>{"  "}</Text>
                )}
                <Text
                  {...(focus === "projects" && projIdx === i
                    ? { bold: true }
                    : {})}
                >
                  {proj.name}
                </Text>
                <Text dimColor> ({proj.slug})</Text>
              </Box>
            ))
          )}
        </Box>

        {/* Separator */}
        <Box flexDirection="column" width={3}>
          <Text dimColor> | </Text>
        </Box>

        {/* Right column: Messages */}
        <Box flexDirection="column" width="67%">
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
      </Box>

      {/* Help bar */}
      <Box marginTop={1}>
        <Text dimColor>
          Tab switch focus | ↑↓ navigate | Enter open
          {focus === "messages" ? "/mark done" : ""} | [r] refresh
        </Text>
      </Box>
    </Box>
  );
}
