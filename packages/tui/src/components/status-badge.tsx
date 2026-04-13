import React from 'react';
import { Text } from 'ink';
import {
  TASK_STATUS_COLORS,
  ISSUE_STATUS_COLORS,
  PRIORITY_COLORS,
  SEVERITY_COLORS,
  NOTE_STATUS_COLORS,
  MESSAGE_STATUS_COLORS,
  KIND_COLORS,
  TASK_STATUS_LABELS,
  ISSUE_STATUS_LABELS,
  label,
} from '../theme.js';

type BadgeKind = 'task' | 'issue' | 'priority' | 'severity' | 'note' | 'message' | 'kind';

const COLOR_MAPS: Record<BadgeKind, Record<string, string>> = {
  task:     TASK_STATUS_COLORS,
  issue:    ISSUE_STATUS_COLORS,
  priority: PRIORITY_COLORS,
  severity: SEVERITY_COLORS,
  note:     NOTE_STATUS_COLORS,
  message:  MESSAGE_STATUS_COLORS,
  kind:     KIND_COLORS,
};

const LABEL_MAPS: Partial<Record<BadgeKind, Record<string, string>>> = {
  task:  TASK_STATUS_LABELS,
  issue: ISSUE_STATUS_LABELS,
};

interface StatusBadgeProps {
  type: BadgeKind;
  value: string;
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  const colorMap = COLOR_MAPS[type];
  const color = colorMap[value] ?? 'white';
  const labelMap = LABEL_MAPS[type];
  const display = labelMap ? label(labelMap, value) : value;

  return (
    <Text color={color} bold>{display}</Text>
  );
}
