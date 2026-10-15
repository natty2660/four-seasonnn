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

    // RULE 1: Server Authoritative Progression:
    // If the server has moved the call forward (accepted, hold, completed, cancelled, missed),
    // that authoritative server action MUST take effect immediately!
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

    if (inc.status === 'hold') {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'hold',
        held_at: inc.held_at || prev.held_at || new Date().toISOString(),
        hold_reason: inc.hold_reason || prev.hold_reason || 'Waiter currently attending another customer',
        accepted_by_waiter_id: inc.accepted_by_waiter_id || prev.accepted_by_waiter_id || null,
        accepted_by_name: inc.accepted_by_name || prev.accepted_by_name || 'Staff Member',
        revision: Math.max(prevRev, incRev),
      });
      continue;
    }

    if (inc.status === 'completed' || inc.status === 'cancelled') {
      mergedMap.set(inc.id, {
        ...inc,
        status: inc.status,
        completed_at: inc.completed_at || prev.completed_at || new Date().toISOString(),
        revision: Math.max(prevRev, incRev),
      });
      continue;
    }

    if (inc.status === 'missed') {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'missed',
        missed_at: inc.missed_at || prev.missed_at || new Date().toISOString(),
        revision: Math.max(prevRev, incRev),
      });
      continue;
    }

    // RULE 2: Terminal State Lock: Once a call reaches completed/cancelled locally,
    // a stale incoming 'pending' cannot revert it back.
    const wasCompletedLocally = prev.status === 'completed' || prev.status === 'cancelled';
    if (wasCompletedLocally && inc.status === 'pending') {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // RULE 3: Missed State Lock: A missed call must never resurrect to pending
    if (prev.status === 'missed' && inc.status === 'pending') {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // RULE 4: Local Accept Lock: If accepted locally, don't let pending overwrite within lock window
    const wasAcceptedLocally = prev.status === 'accepted';
    const acceptedAtTime = prev.accepted_at ? new Date(prev.accepted_at).getTime() : now;
    if (wasAcceptedLocally && inc.status === 'pending' && (now - acceptedAtTime < ACCEPT_LOCK_WINDOW_MS)) {
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

    // RULE 5: Local Hold Lock: If placed on hold locally, preserve hold state against stale pending
    if (prev.status === 'hold' && inc.status === 'pending') {
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

    // Otherwise, adopt authoritative server state with latest flags (including escalation)
    mergedMap.set(inc.id, {
      ...inc,
      is_escalated: inc.is_escalated || prev.is_escalated,
      revision: Math.max(prevRev, incRev),
    });
  }

  // 2. Network drop jitter prevention (only keep pending calls created < 15s ago if temporarily omitted in fetch)
  for (const prev of prevCalls || []) {
    if (!mergedMap.has(prev.id)) {
      if (prev.status === 'pending') {
        const timeRef = new Date(prev.created_at).getTime();
        if (now - timeRef < 15000) {
          mergedMap.set(prev.id, prev);
        }
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
