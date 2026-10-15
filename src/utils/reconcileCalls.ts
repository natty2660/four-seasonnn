import type { WaiterCall } from '../types/index.js';
import { getCallPriorityWeight } from '../types/index.js';

/**
 * Authoritative reconciliation for live waiter calls.
 * Compares monotonic sequence revisions (revision: number) to eliminate out-of-order polling collisions.
 * Completely eliminates flickering, disappearing calls, duplicate rings, and keeps accepted status locked.
 */
export function reconcileWaiterCalls(prevCalls: WaiterCall[], incomingCalls: WaiterCall[]): WaiterCall[] {
  const prevMap = new Map((prevCalls || []).map((c) => [c.id, c]));
  const mergedMap = new Map<string, WaiterCall>();

  // Lock duration for locally accepted calls: 120 seconds
  const ACCEPT_LOCK_WINDOW_MS = 120000;
  // Terminal status lock duration (completed/cancelled shouldn't resurrect to pending or accepted)
  const TERMINAL_LOCK_WINDOW_MS = 60000;
  const now = Date.now();

  // 1. Process all incoming authoritative calls from backend
  for (const inc of incomingCalls || []) {
    const prev = prevMap.get(inc.id);
    if (!prev) {
      mergedMap.set(inc.id, {
        ...inc,
        revision: inc.revision ?? 1,
      });
      continue;
    }

    const prevRev = prev.revision ?? 1;
    const incRev = inc.revision ?? 1;

    // RULE 1: If incoming revision is strictly older than what we already have confirmed locally, DISCARD incoming stale state!
    if (incRev < prevRev) {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // RULE 2: Terminal State Lock: Once a call reaches completed/cancelled, older or equal revisions cannot revert it to pending or hold
    const wasCompletedLocally = prev.status === 'completed' || prev.status === 'cancelled';
    const isStaleActiveIncoming = inc.status === 'pending' || inc.status === 'hold';
    const completedAtTime = prev.completed_at ? new Date(prev.completed_at).getTime() : now;
    if (wasCompletedLocally && isStaleActiveIncoming && (now - completedAtTime < TERMINAL_LOCK_WINDOW_MS)) {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // RULE 3: Missed State Lock: A missed call (timed out) must never resurrect to pending to ring again
    if (prev.status === 'missed' && inc.status === 'pending') {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // RULE 4: Local Accept Lock: If accepted locally, don't let pending overwrite if revisions are equal or within accept lock
    const wasAcceptedLocally = prev.status === 'accepted';
    const acceptedAtTime = prev.accepted_at ? new Date(prev.accepted_at).getTime() : now;
    if (wasAcceptedLocally && inc.status === 'pending' && (incRev <= prevRev || now - acceptedAtTime < ACCEPT_LOCK_WINDOW_MS)) {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'accepted',
        accepted_by_waiter_id: prev.accepted_by_waiter_id || inc.accepted_by_waiter_id || null,
        accepted_by_name: prev.accepted_by_name || inc.accepted_by_name || 'Staff Member',
        accepted_at: prev.accepted_at || new Date().toISOString(),
        revision: Math.max(prevRev, incRev),
      });
      continue;
    }

    // RULE 5: Hold Lock: If placed on hold locally, preserve hold state against stale pending
    if (prev.status === 'hold' && inc.status === 'pending' && incRev <= prevRev) {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'hold',
        held_at: prev.held_at || new Date().toISOString(),
        hold_reason: prev.hold_reason || 'Waiter currently attending another customer',
        accepted_by_waiter_id: prev.accepted_by_waiter_id || inc.accepted_by_waiter_id || null,
        accepted_by_name: prev.accepted_by_name || inc.accepted_by_name || 'Staff Member',
        revision: Math.max(prevRev, incRev),
      });
      continue;
    }

    // RULE 6: Waiter accepted on server - firmly lock in
    if (inc.status === 'accepted') {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'accepted',
        accepted_by_waiter_id: inc.accepted_by_waiter_id || prev.accepted_by_waiter_id || null,
        accepted_by_name: inc.accepted_by_name || prev.accepted_by_name || 'Staff Member',
        accepted_at: inc.accepted_at || prev.accepted_at || new Date().toISOString(),
        revision: Math.max(prevRev, incRev),
      });
      continue;
    }

    // Otherwise, accept newer authoritative server state
    mergedMap.set(inc.id, {
      ...inc,
      revision: Math.max(prevRev, incRev),
    });
  }

  // 2. Flicker prevention & history preservation:
  for (const prev of prevCalls || []) {
    if (!mergedMap.has(prev.id)) {
      if (prev.status === 'pending' || prev.status === 'hold') {
        const timeRef = new Date(prev.created_at).getTime();
        if (now - timeRef < 60000) {
          mergedMap.set(prev.id, prev);
        }
      } else if (prev.status === 'completed' || prev.status === 'cancelled' || prev.status === 'missed') {
        // Permanently preserve completed/cancelled history in dashboard records
        mergedMap.set(prev.id, prev);
      }
    }
  }

  // 3. Stably sort by lifecycle status: accepted (4000) > pending (3000) > hold (2500) > missed (1500) > resolved (1000)
  const getStatusOrder = (status: string): number => {
    if (status === 'accepted') return 4000;
    if (status === 'pending') return 3000;
    if (status === 'hold') return 2500;
    if (status === 'missed') return 1500;
    return 1000;
  };

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => {
    // 1. Prioritize active pending calls first, followed by in-progress accepted, then resolved
    const statusDiff = getStatusOrder(b.status) - getStatusOrder(a.status);
    if (statusDiff !== 0) return statusDiff;

    // 2. Prioritize by call type priority ranking: Urgent (500) > Bill (400) > Order (300) > Water (200) > General (100)
    const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
    if (priorityDiff !== 0) return priorityDiff;

    // 3. Tie-breaker: newest calls first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return result;
}
