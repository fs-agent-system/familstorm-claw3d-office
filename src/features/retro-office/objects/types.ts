import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import type { RefObject } from "react";
import type {
  FurnitureItem,
  OfficeAgent,
  RenderAgent,
} from "@/features/retro-office/core/types";
import type { OfficeAgentState } from "@/lib/office/schema";

export type BasicFurnitureModelProps = {
  item: FurnitureItem;
  onPointerDown?: (uid: string) => void;
  onPointerOver?: (uid: string) => void;
  onPointerOut?: () => void;
  editMode?: boolean;
};

export type InteractiveFurnitureModelProps = {
  item: FurnitureItem;
  isSelected: boolean;
  isHovered: boolean;
  editMode: boolean;
  kanbanTaskCount?: number;
  doorOpen?: boolean;
  onPointerDown: (uid: string) => void;
  onPointerOver: (uid: string) => void;
  onPointerOut: () => void;
  onClick?: (uid: string) => void;
};

export type AgentModelProps = {
  agentId: string;
  name: string;
  subtitle?: string | null;
  status: OfficeAgent["status"];
  /** Rich 10-state (HERMES-09 §10) — drives the head bubble emoji/colour; falls back to `status`. */
  officeState?: OfficeAgentState | null;
  color: string;
  appearance?: AgentAvatarProfile | null;
  agentsRef: RefObject<RenderAgent[]>;
  agentLookupRef?: RefObject<Map<string, RenderAgent>>;
  onHover?: (id: string) => void;
  onUnhover?: () => void;
  onClick?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  showSpeech?: boolean;
  speechText?: string | null;
  suppressSpeechBubble?: boolean;
};
