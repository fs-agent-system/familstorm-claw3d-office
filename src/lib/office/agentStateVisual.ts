import type { OfficeAgentState } from "@/lib/office/schema";

/**
 * Visual language for the 10 operational agent states (HERMES-09 §11).
 *
 * Colour cue: idle xám · working xanh · thinking tím nhạt · blocked đỏ ·
 * reviewing vàng · offline mờ (+ waiting/meeting/completed/error).
 *
 * NOTE: keep every Tailwind class as a full literal string so the JIT scanner
 * generates it — do not build class names by concatenation.
 */
export type AgentStateVisual = {
  /** Tailwind bg-* for the small status dot. */
  dotClass: string;
  /** Tailwind classes for a status pill (bg + text + ring). */
  pillClass: string;
  /** Short lowercase label. */
  label: string;
  /** Optional emoji badge; empty string = none. */
  emoji: string;
};

export const AGENT_STATE_VISUAL: Record<OfficeAgentState, AgentStateVisual> = {
  idle: {
    dotClass: "bg-gray-400",
    pillClass: "bg-gray-800/40 text-gray-300 ring-1 ring-gray-700/40",
    label: "idle",
    emoji: "",
  },
  thinking: {
    dotClass: "bg-purple-300",
    pillClass: "bg-purple-900/40 text-purple-300 ring-1 ring-purple-800/40",
    label: "thinking",
    emoji: "💭",
  },
  working: {
    dotClass: "bg-green-400",
    pillClass: "bg-green-900/40 text-green-400 ring-1 ring-green-800/40",
    label: "working",
    emoji: "",
  },
  waiting: {
    dotClass: "bg-cyan-400",
    pillClass: "bg-cyan-900/40 text-cyan-300 ring-1 ring-cyan-800/40",
    label: "waiting",
    emoji: "⏳",
  },
  reviewing: {
    dotClass: "bg-yellow-400",
    pillClass: "bg-yellow-900/30 text-yellow-500 ring-1 ring-yellow-800/30",
    label: "reviewing",
    emoji: "🔍",
  },
  blocked: {
    dotClass: "bg-red-400",
    pillClass: "bg-red-900/40 text-red-400 ring-1 ring-red-800/40",
    label: "blocked",
    emoji: "⚠",
  },
  meeting: {
    dotClass: "bg-indigo-400",
    pillClass: "bg-indigo-900/40 text-indigo-300 ring-1 ring-indigo-800/40",
    label: "meeting",
    emoji: "👥",
  },
  completed: {
    dotClass: "bg-emerald-400",
    pillClass: "bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-800/40",
    label: "completed",
    emoji: "✓",
  },
  error: {
    dotClass: "bg-rose-600",
    pillClass: "bg-rose-900/50 text-rose-400 ring-1 ring-rose-800/50",
    label: "error",
    emoji: "✕",
  },
  offline: {
    dotClass: "bg-gray-600",
    pillClass: "bg-gray-900/40 text-gray-500 ring-1 ring-gray-800/40",
    label: "offline",
    emoji: "🌙",
  },
};

/**
 * Resolve the visual for an agent. Prefers the rich 10-state value when present
 * (remote presence via the Office Bridge); otherwise falls back to the legacy
 * 3-state scene status so non-Familstorm agents keep their look.
 */
export const resolveAgentStateVisual = (
  officeState: OfficeAgentState | undefined,
  fallback: { isError: boolean; working: boolean },
): AgentStateVisual => {
  if (officeState) return AGENT_STATE_VISUAL[officeState];
  if (fallback.isError) return AGENT_STATE_VISUAL.error;
  if (fallback.working) return AGENT_STATE_VISUAL.working;
  return AGENT_STATE_VISUAL.idle;
};
