/**
 * Familstorm agent roster — 8 fixed Hermes agents rendered in the Virtual Office.
 *
 * CANONICAL ID = `label` (khớp Hermes profile + role:<label> trên GitHub) — bất biến.
 * `githubLogin` (fs-*) là identity GitHub THẬT (khác doc gốc vốn ghi email); email chỉ hiển thị.
 * Xem HERMES-09 §2.2 (#4): map theo fs-* login, KHÔNG theo email.
 *
 * Nguồn dữ liệu nghiệp vụ (task/status) KHÔNG nằm ở đây — đến từ Event Bridge (gate.log + GitHub).
 * File này chỉ giữ cấu hình trình bày: định danh, desk/room, avatar.
 */

export type AgentType = "agent" | "hybrid";

export interface VirtualOfficeAgentProfile {
  /** Canonical id = Hermes profile label. Bất biến sau khi có lịch sử. */
  id: string;
  label: string;
  /** GitHub identity thật (fs-*) — dùng để map assignee/PR/review về đúng agent. */
  githubLogin: string;
  displayName: string;
  role: string;
  /** Chỉ hiển thị/liên hệ — KHÔNG dùng làm primary key. */
  email: string;
  type: AgentType;
  department: string;
  deskId: string;
  defaultRoomId: string;
  avatarId: string;
  colorTag?: string;
  /** Sứ Giả (account-manager) = hybrid, người thật có thể takeover (khớp AM DRAFT-ONLY). */
  humanOverride?: boolean;
}

export const FAMILSTORM_AGENT_ROSTER: VirtualOfficeAgentProfile[] = [
  {
    id: "project-coordinator",
    label: "project-coordinator",
    githubLogin: "fs-tieuly",
    displayName: "Tiểu Ly",
    role: "Project Coordinator",
    email: "ngochoa.cth53@gmail.com",
    type: "agent",
    department: "coordination",
    deskId: "desk-project-coordinator",
    defaultRoomId: "coordination-room",
    avatarId: "avatar-tieu-ly",
    colorTag: "#E11D21",
  },
  {
    id: "technical-lead",
    label: "technical-lead",
    githubLogin: "fs-bro",
    displayName: "Bro",
    role: "Technical Lead",
    email: "",
    type: "agent",
    department: "engineering",
    deskId: "desk-technical-lead",
    defaultRoomId: "engineering-room",
    avatarId: "avatar-bro",
    colorTag: "#0969DA",
  },
  {
    id: "developer-backend",
    label: "developer-backend",
    githubLogin: "fs-brian-hermes",
    displayName: "Brian Hermes",
    role: "Developer Backend",
    email: "",
    type: "agent",
    department: "engineering",
    deskId: "desk-backend",
    defaultRoomId: "engineering-room",
    avatarId: "avatar-brian-hermes",
    colorTag: "#8250DF",
  },
  {
    id: "developer-frontend",
    label: "developer-frontend",
    githubLogin: "fs-lego-hermes",
    displayName: "Lego Hermes",
    role: "Developer Frontend",
    email: "",
    type: "agent",
    department: "engineering",
    deskId: "desk-frontend",
    defaultRoomId: "engineering-room",
    avatarId: "avatar-lego-hermes",
    colorTag: "#FBCA04",
  },
  {
    id: "devops",
    label: "devops",
    githubLogin: "fs-mr-robot",
    displayName: "Mr. Robot",
    role: "DevOps",
    email: "",
    type: "agent",
    department: "operations",
    deskId: "desk-devops",
    defaultRoomId: "operations-room",
    avatarId: "avatar-mr-robot",
    colorTag: "#006B75",
  },
  {
    id: "qa-tester",
    label: "qa-tester",
    githubLogin: "fs-hoamai",
    displayName: "Hoa Mai",
    role: "QA Tester",
    email: "",
    type: "agent",
    department: "quality",
    deskId: "desk-qa",
    defaultRoomId: "qa-lab",
    avatarId: "avatar-hoa-mai",
    colorTag: "#BC4C00",
  },
  {
    id: "designer",
    label: "designer",
    githubLogin: "fs-chubeo",
    displayName: "Chú Beo",
    role: "Designer",
    email: "",
    type: "agent",
    department: "design",
    deskId: "desk-designer",
    defaultRoomId: "design-studio",
    avatarId: "avatar-chu-beo",
    colorTag: "#BF3989",
  },
  {
    id: "account-manager",
    label: "account-manager",
    githubLogin: "fs-sugia",
    displayName: "Sứ Giả",
    role: "Account Manager",
    email: "",
    type: "hybrid",
    department: "client-success",
    deskId: "desk-account-manager",
    defaultRoomId: "client-room",
    avatarId: "avatar-su-gia",
    colorTag: "#0E8A16",
    humanOverride: true,
  },
];

/** Lookup nhanh theo label (canonical id). */
export const ROSTER_BY_LABEL: Readonly<Record<string, VirtualOfficeAgentProfile>> =
  Object.freeze(
    Object.fromEntries(FAMILSTORM_AGENT_ROSTER.map((a) => [a.label, a])),
  );

/** Lookup theo GitHub login (map assignee/PR-author → agent). */
export const ROSTER_BY_GITHUB: Readonly<Record<string, VirtualOfficeAgentProfile>> =
  Object.freeze(
    Object.fromEntries(FAMILSTORM_AGENT_ROSTER.map((a) => [a.githubLogin, a])),
  );

/** Desk assignment ổn định theo label — KHÔNG phụ thuộc thứ tự Hermes trả về (HERMES-09 §6.2). */
export const DESK_ASSIGNMENTS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(FAMILSTORM_AGENT_ROSTER.map((a) => [a.label, a.deskId])),
);

export const FAMILSTORM_OFFICE_ID = "familstorm-main-office";
