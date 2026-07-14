"use client";

// DEV-ONLY demo page — đủ 10 trạng thái + badge GitHub cho office 3D.
// Mở: http://localhost:3000/dev/office-preview (chặn ở production build).
// 8 agent roster + 2 agent demo phụ để phủ hết 10 state (HERMES-09 §10).

import { useState } from "react";
import { RetroOffice3D } from "@/features/retro-office/RetroOffice3D";
import type { OfficeAgent } from "@/features/retro-office/core/types";
import { collapseOfficeAgentState, type OfficeAgentState } from "@/lib/office/schema";
import {
  FAMILSTORM_AGENT_ROSTER,
  familstormAvatarUrl,
} from "@/config/familstorm-agent-roster";

const ROSTER_STATES: OfficeAgentState[] = [
  "thinking",
  "reviewing",
  "working",
  "blocked",
  "waiting",
  "meeting",
  "completed",
  "idle",
];

type MockWork = NonNullable<OfficeAgent["workItem"]>;

const MOCK_WORK_BY_STATE: Partial<Record<OfficeAgentState, MockWork>> = {
  reviewing: {
    kind: "pr",
    repo: "fs-agent-system/phuong-tri",
    number: 43,
    title: "DevOps scaffold — Dockerfile + CI smoke",
    url: "https://github.com/fs-agent-system/phuong-tri/pull/43",
  },
  working: {
    kind: "issue",
    repo: "fs-agent-system/teach-finder-landing",
    number: 8,
    title: "MODULE M5: CTA lead form + capture",
    url: "https://github.com/fs-agent-system/teach-finder-landing/issues/8",
  },
  blocked: {
    kind: "issue",
    repo: "fs-agent-system/phuong-tri",
    number: 45,
    title: "DevOps: wire staging v2 (frontend+cms subdomain)",
    url: "https://github.com/fs-agent-system/phuong-tri/issues/45",
  },
  completed: {
    kind: "pr",
    repo: "fs-agent-system/teach-finder-landing",
    number: 11,
    title: "feat: Module M5 - CTA lead form",
    url: "https://github.com/fs-agent-system/teach-finder-landing/pull/11",
  },
};

const buildAgents = (): OfficeAgent[] => {
  const roster = FAMILSTORM_AGENT_ROSTER.map((profile, i) => {
    const state = ROSTER_STATES[i % ROSTER_STATES.length];
    return {
      id: `remote:${profile.label}`,
      name: profile.displayName,
      status: collapseOfficeAgentState(state),
      officeState: state,
      avatarUrl: familstormAvatarUrl(profile.label),
      workItem: MOCK_WORK_BY_STATE[state] ?? null,
      color: profile.colorTag ?? "#888",
      item: "laptop",
      avatarProfile: null,
    } satisfies OfficeAgent;
  });
  // 2 state còn lại (error/offline) demo bằng agent phụ — roster thật chỉ có 8 chỗ.
  const extras: OfficeAgent[] = (
    [
      ["error", "Demo Error", "#D73A49"],
      ["offline", "Demo Offline", "#6E7781"],
    ] as const
  ).map(([state, name, color]) => ({
    id: `remote:demo-${state}`,
    name,
    status: collapseOfficeAgentState(state),
    officeState: state,
    color,
    item: "laptop",
    avatarProfile: null,
  }));
  return [...roster, ...extras];
};

export default function OfficePreviewPage() {
  const [agents] = useState(buildAgents);
  if (process.env.NODE_ENV === "production") return null;
  const reviewingId =
    agents.find((agent) => agent.officeState === "reviewing")?.id ?? null;
  return (
    <div className="h-screen w-screen">
      <RetroOffice3D
        agents={agents}
        githubReviewAgentId={reviewingId}
        officeTitle="FAMILSTORM HQ — DEMO"
        officeTitleLoaded
      />
    </div>
  );
}
