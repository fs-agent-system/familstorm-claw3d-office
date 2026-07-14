"use strict";

/**
 * Hermes Office Bridge — READ-ONLY gate.log → office presence.
 *
 * Reads the Hermes cadence decision log (`~/.hermes-cron/gate.log`, written by
 * `ops/scripts/cron-gate.sh`) and serves an `OfficePresenceSnapshot` at
 * `GET /presence`, so the Claw3D Virtual Office can render the 8 fixed
 * Familstorm agents with a live operational state.
 *
 * This bridge NEVER starts agents, writes to Hermes, or mutates any state.
 * It only tails a log file and translates it into the presence contract in
 * `src/lib/office/presence.ts` (`normalizeOfficePresenceSnapshot`).
 *
 * Wire it into the office as a remote presence endpoint:
 *   remoteOfficeSourceKind = "presence_endpoint"
 *   remoteOfficePresenceUrl = http://<host>:<port>/presence
 *   remoteOfficeToken       = <HERMES_OFFICE_BRIDGE_TOKEN>   (optional)
 *
 * gate.log line format (see cron-gate.sh `glog()`):
 *   2026-07-13T15:59:44+0700 [technical-lead] DONE: session_id: ... message
 *   <ISO8601-tz>             [<role>]         <VERB>: <message>
 *
 * Environment variables:
 *   HERMES_GATE_LOG            Path to gate.log     (default: ~/.hermes-cron/gate.log)
 *   HERMES_OFFICE_BRIDGE_PORT  HTTP port            (default: 18790)
 *   HERMES_OFFICE_WORKSPACE_ID workspaceId in snap  (default: familstorm-main-office)
 *   HERMES_OFFICE_BRIDGE_TOKEN Bearer token         (default: empty = no auth)
 *   HERMES_OFFICE_FRESH_MIN    "just worked" window (default: 12 minutes)
 *   HERMES_OFFICE_WORK_STALE_MIN  crashed-WORK guard(default: 60 minutes)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── .env loader (same convention as hermes-gateway-adapter.js) ──────────────
function loadDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadRuntimeEnv() {
  const cwd = process.cwd();
  loadDotenvFile(path.join(cwd, ".env.local"));
  loadDotenvFile(path.join(cwd, ".env"));
}

loadRuntimeEnv();

// ── Config ──────────────────────────────────────────────────────────────────
const GATE_LOG =
  (process.env.HERMES_GATE_LOG || "").trim() ||
  path.join(os.homedir(), ".hermes-cron", "gate.log");
const PORT = Number.parseInt(process.env.HERMES_OFFICE_BRIDGE_PORT || "18790", 10);
const WORKSPACE_ID = (process.env.HERMES_OFFICE_WORKSPACE_ID || "familstorm-main-office").trim();
const TOKEN = (process.env.HERMES_OFFICE_BRIDGE_TOKEN || "").trim();
// "just completed" window (minutes) → shows `completed` then settles to idle.
const FRESH_MIN = Number.parseFloat(process.env.HERMES_OFFICE_FRESH_MIN || "0.25"); // ~15s (§5)
// A WORK line with no DONE for this long → assume crashed session, fall to idle.
const WORK_STALE_MIN = Number.parseFloat(process.env.HERMES_OFFICE_WORK_STALE_MIN || "60");
// A fresh WORK line (seconds) reads as `thinking` before settling into `working`.
const THINK_SEC = Number.parseFloat(process.env.HERMES_OFFICE_THINK_SEC || "25");
// Working hours (local VPS tz). Outside → whole office `offline` (§10 OFF-HOURS).
const OPEN_HOUR = Number.parseInt(process.env.HERMES_OFFICE_OPEN_HOUR || "6", 10);
const CLOSE_HOUR = Number.parseInt(process.env.HERMES_OFFICE_CLOSE_HOUR || "22", 10);

/**
 * Role → display metadata. Canonical id = Hermes profile `label` == role key,
 * so `agentId` is the role itself.
 *
 * MUST stay in sync with src/config/familstorm-agent-roster.ts (the canonical
 * roster). Only the 8 fixed Familstorm agents are rendered.
 */
const ROLE_META = {
  "project-coordinator": { name: "Tiểu Ly", deskId: "desk-project-coordinator" },
  "technical-lead": { name: "Bro", deskId: "desk-technical-lead" },
  "developer-backend": { name: "Brian Hermes", deskId: "desk-backend" },
  "developer-frontend": { name: "Lego Hermes", deskId: "desk-frontend" },
  devops: { name: "Mr. Robot", deskId: "desk-devops" },
  "qa-tester": { name: "Hoa Mai", deskId: "desk-qa" },
  designer: { name: "Chú Beo", deskId: "desk-designer" },
  "account-manager": { name: "Sứ Giả", deskId: "desk-account-manager" },
};

// ── gate.log verb → operational state (10-state model, HERMES-09 §5/§10) ─────
// SKIP (gate didn't run) and MERGE-REFUSED (a policy note, not agent activity)
// are intentionally ignored: they must NOT overwrite the last real state.
const IGNORED_VERBS = new Set(["SKIP", "MERGE-REFUSED"]);

const FAILURE_RE =
  /connection error|no active credentials|http [45]\d\d|\berror:/i;
// A WORK line about a PR review / QA verification → `reviewing` (Review Center).
const REVIEW_RE = /\breview\b|\bpr #?\d|awaiting .*review|qa verif|qa check/i;

// Line: "<ts> [<role>] <VERB>: <msg>"  (VERB is UPPERCASE letters + hyphen)
const LINE_RE = /^(\S+)\s+\[([^\]]+)\]\s+([A-Z][A-Z-]*):\s*(.*)$/;

// Per-role latest state-bearing entry: { tsMs, verb, msg }
const roleState = new Map();

let lastOffset = 0;
let carry = ""; // partial trailing line between reads

function parseTsMs(ts) {
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function ingestLine(line) {
  const m = LINE_RE.exec(line);
  if (!m) return;
  const [, ts, role, verb, msg] = m;
  if (!ROLE_META[role]) return; // only the 8 fixed agents
  if (IGNORED_VERBS.has(verb)) return; // keep previous state
  roleState.set(role, { tsMs: parseTsMs(ts), verb, msg: msg.trim() });
}

// Incrementally read appended bytes; handle truncation/rotation.
function refreshFromLog() {
  let stat;
  try {
    stat = fs.statSync(GATE_LOG);
  } catch {
    return; // log not present yet
  }
  if (stat.size < lastOffset) {
    // truncated or rotated → re-read from the start
    lastOffset = 0;
    carry = "";
    roleState.clear();
  }
  if (stat.size === lastOffset) return;
  const fd = fs.openSync(GATE_LOG, "r");
  try {
    const length = stat.size - lastOffset;
    const buf = Buffer.allocUnsafe(length);
    const read = fs.readSync(fd, buf, 0, length, lastOffset);
    lastOffset += read;
    const chunk = carry + buf.toString("utf8", 0, read);
    const lines = chunk.split("\n");
    carry = lines.pop() ?? ""; // last piece may be incomplete
    for (const line of lines) {
      if (line) ingestLine(line);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function isOffHours(nowMs) {
  const hour = new Date(nowMs).getHours();
  // Open [OPEN_HOUR, CLOSE_HOUR); everything else is off-hours.
  return hour < OPEN_HOUR || hour >= CLOSE_HOUR;
}

// Resolve one of the 10 operational states from the latest state-bearing line.
// Off-hours (whole office) is applied by the caller, not here.
function computeState(entry, nowMs) {
  if (!entry) return "idle";
  const { verb, msg, tsMs } = entry;
  const ageMin = (nowMs - tsMs) / 60000;
  const ageSec = (nowMs - tsMs) / 1000;
  const failure = FAILURE_RE.test(msg);

  switch (verb) {
    case "IDLE":
      return "idle";
    case "WARN":
      return "error";
    case "BLOCKED":
      return "blocked";
    case "ESCALATED": // needs:manager → blocked + notify (§10)
      return "blocked";
    case "HANDOFF":
      return "meeting";
    case "EVIDENCE": // produced work, awaiting next step (e.g. review/CI)
      return "waiting";
    case "WORK": {
      if (REVIEW_RE.test(msg)) return "reviewing";
      if (ageMin > WORK_STALE_MIN) return "idle"; // crashed-session guard
      if (ageSec <= THINK_SEC) return "thinking"; // just spun up
      return "working";
    }
    case "DONE":
      if (failure) return "error";
      return ageMin <= FRESH_MIN ? "completed" : "idle";
    case "MERGED":
      return ageMin <= FRESH_MIN ? "completed" : "idle";
    case "PROMOTE-STAGING":
      return ageMin <= WORK_STALE_MIN ? "working" : "idle"; // DevOps activity
    default:
      return failure ? "error" : "idle";
  }
}

function buildSnapshot() {
  refreshFromLog();
  const nowMs = Date.now();
  const offHours = isOffHours(nowMs);
  const agents = Object.keys(ROLE_META).map((role) => {
    const meta = ROLE_META[role];
    const entry = roleState.get(role);
    // OFF-HOURS overrides everything → whole office offline (§10).
    const state = offHours ? "offline" : computeState(entry, nowMs);
    const agent = {
      agentId: role,
      name: meta.name,
      state,
      preferredDeskId: meta.deskId,
    };
    // Extra diagnostic fields (ignored by normalizeOfficePresenceSnapshot).
    if (entry) {
      agent.hermesVerb = entry.verb;
      agent.lastActivityAt = new Date(entry.tsMs).toISOString();
      agent.note = entry.msg.slice(0, 160);
    }
    return agent;
  });
  return {
    workspaceId: WORKSPACE_ID,
    timestamp: new Date(nowMs).toISOString(),
    agents,
  };
}

// ── HTTP server ───────────────────────────────────────────────────────────
function isAuthorized(req) {
  if (!TOKEN) return true;
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.trim() === `Bearer ${TOKEN}`) return true;
  const custom = req.headers["x-claw3d-office-token"];
  if (typeof custom === "string" && custom.trim() === TOKEN) return true;
  return false;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, X-Claw3D-Office-Token",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, X-Claw3D-Office-Token",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    res.end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/") {
    sendJson(res, 200, {
      ok: true,
      service: "hermes-office-bridge",
      gateLog: GATE_LOG,
      gateLogPresent: fs.existsSync(GATE_LOG),
      workspaceId: WORKSPACE_ID,
      agents: Object.keys(ROLE_META).length,
    });
    return;
  }

  if (url.pathname === "/presence") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      sendJson(res, 200, buildSnapshot());
    } catch (err) {
      sendJson(res, 500, { error: String((err && err.message) || err) });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

// Prime state from the existing log before accepting traffic.
refreshFromLog();

server.listen(PORT, () => {
  console.log(`[office-bridge] listening on http://localhost:${PORT}`);
  console.log(`[office-bridge] gate.log: ${GATE_LOG} (present=${fs.existsSync(GATE_LOG)})`);
  console.log(`[office-bridge] workspace: ${WORKSPACE_ID}, auth=${TOKEN ? "on" : "off"}`);
  console.log(`[office-bridge] presence: http://localhost:${PORT}/presence`);
});
