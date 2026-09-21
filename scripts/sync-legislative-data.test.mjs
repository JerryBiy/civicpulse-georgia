import assert from "node:assert/strict";
import test from "node:test";

import {
  activeSessionIds,
  matchProviderSession,
  normalizeMasterList,
  normalizeSessions,
  shouldRefreshSession,
} from "./sync-legislative-data.mjs";

test("normalizes and orders LegiScan sessions", () => {
  const sessions = normalizeSessions([
    {
      session_id: "10",
      session_title: "2023-2024 Regular Session",
      year_start: "2023",
      year_end: "2024",
      prior: "1",
      special: "0",
      dataset_hash: "old",
    },
    {
      session_id: "20",
      session_title: "2025-2026 Regular Session",
      year_start: "2025",
      year_end: "2026",
      prior: "0",
      special: "0",
      dataset_hash: "new",
    },
  ]);
  assert.deepEqual(sessions.map((session) => session.session_id), [20, 10]);
  assert.equal(sessions[0].prior, false);
});

test("refreshes active, missing, and corrected archives only", () => {
  const sessions = [
    { session_id: 20, prior: false, year_end: 2026, dataset_hash: "active" },
    { session_id: 10, prior: true, year_end: 2024, dataset_hash: "archive-v2" },
  ];
  const active = activeSessionIds(sessions);
  assert.equal(shouldRefreshSession(sessions[0], { bill_count: 12, dataset_hash: "active" }, active), true);
  assert.equal(shouldRefreshSession(sessions[1], { bill_count: 12, dataset_hash: "archive-v2" }, active), false);
  assert.equal(shouldRefreshSession(sessions[1], { bill_count: 12, dataset_hash: "archive-v1" }, active), true);
  assert.equal(shouldRefreshSession(sessions[1], null, active), true);
});

test("normalizes master-list bills without discarding their provider identity", () => {
  const session = {
    session_id: 20,
    session_name: "2025-2026 Regular Session",
    year_start: 2025,
  };
  const bills = normalizeMasterList(
    {
      session: { session_id: 20 },
      0: {
        bill_id: 123,
        number: "HB 10",
        title: "Example bill",
        status: 2,
        last_action: "Assigned to Education Committee",
        change_hash: "abc",
      },
    },
    session,
  );
  assert.equal(bills.length, 1);
  assert.equal(bills[0].bill_number, "HB10");
  assert.equal(bills[0].legiscan_id, "123");
  assert.equal(bills[0].current_committee, "Education Committee");
});

test("maps LegiScan sessions to the matching official Georgia session", () => {
  const match = matchProviderSession(
    { year_start: 2025, year_end: 2026, special: false },
    {
      sessionId: 87,
      sessions: [
        { id: 87, description: "2025-2026 Regular Session" },
        { id: 91, description: "2026 Special Session", special: true },
      ],
    },
  );
  assert.equal(match?.id, 87);
});
