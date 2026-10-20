import type { WaiterCall } from '../types/index.js';
import { getCallPriorityWeight } from '../types/index.js';

/**
 * Robust reconciliation for live waiter calls.
 * Strictly preserves uncommitted optimistic local revisions to eliminate call flickering,
 * protects recently completed/cancelled history logs, and stably orders active and past calls.
 */
export function reconcileWaiterCalls(
  localCalls: WaiterCall[],
  incomingCalls: WaiterCall[]
): WaiterCall[] {
  const incomingList = Array.isArray(incomingCalls) ? incomingCalls : [];
  const localList = Array.isArray(localCalls) ? localCalls : [];
  const mergedMap = new Map<string, WaiterCall>();

  // 1. Process all incoming authoritative calls from server
  for (const inc of incomingList) {
    mergedMap.set(inc.id, {
      ...inc,
      revision: inc.revision ?? 1,
    });
  }

  // 2. Reconcile with local calls
  const now = Date.now();
  for (const loc of localList) {
    const inc = mergedMap.get(loc.id);
    if (!inc) {
      // Local call not present in incoming array yet.
      // If locally created within last 30s and still active, preserve it so it doesn't vanish while POST request is in flight
      if (loc.status === 'pending' || loc.status === 'accepted' || loc.status === 'hold') {
        const timeRef = new Date(loc.created_at).getTime();
        if (now - timeRef < 30000) {
          mergedMap.set(loc.id, loc);
        }
      } else if (loc.status === 'completed' || loc.status === 'cancelled' || loc.status === 'missed') {
        // Preserve recently completed/cancelled in history log for at least 60s
        const timeRef = new Date(loc.completed_at || loc.missed_at || loc.created_at).getTime();
        if (now - timeRef < 60000) {
          mergedMap.set(loc.id, loc);
        }
      }
      continue;
    }

    // Both incoming and local exist. Decide which status is authoritative:
    // Rule A: If incoming call is 'accepted', 'hold', 'completed', 'cancelled', or 'missed'
    // and local is still 'pending', INCOMING ALWAYS WINS!
    // (A customer never reverts an accepted or queued call back to pending).
    if (loc.status === 'pending' && inc.status !== 'pending') {
      mergedMap.set(loc.id, inc);
      continue;
    }

    // Rule B: If incoming is 'accepted' with an accepted_at timestamp and local has none or is hold/pending,
    // INCOMING WINS!
    if (inc.status === 'accepted' && inc.accepted_at && (!loc.accepted_at || loc.status !== 'accepted')) {
      mergedMap.set(loc.id, inc);
      continue;
    }

    // Rule C: Terminal states ('completed' / 'cancelled')
    // If incoming is completed/cancelled, incoming wins!
    if (inc.status === 'completed' || inc.status === 'cancelled') {
      mergedMap.set(loc.id, inc);
      continue;
    }

    // If local was marked completed/cancelled locally within last 15s and server hasn't committed yet:
    const locIsTerminal = loc.status === 'completed' || loc.status === 'cancelled';
    const locTermTime = new Date(loc.completed_at || loc.created_at).getTime();
    if (locIsTerminal && now - locTermTime < 15000) {
      mergedMap.set(loc.id, loc);
      continue;
    }

    // Rule D: Compare revisions
    const locRev = loc.revision || 1;
    const incRev = inc.revision || 1;
    if (incRev >= locRev) {
      mergedMap.set(loc.id, inc);
      continue;
    }

    // Retain optimistic local state if strictly newer revision
    mergedMap.set(loc.id, loc);
  }

  // 3. Stably sort active calls by priority & history by completion time descending
  const getStatusOrder = (status: string): number => {
    if (status === 'accepted') return 4000;
    if (status === 'pending') return 3000;
    if (status === 'hold') return 2500;
    if (status === 'missed') return 1500;
    return 1000; // completed / cancelled
  };

  return Array.from(mergedMap.values()).sort((a, b) => {
    const statusDiff = getStatusOrder(b.status) - getStatusOrder(a.status);
    if (statusDiff !== 0) return statusDiff;

    // For active calls of the same status, sort by call priority weight first
    if (a.status !== 'completed' && a.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'cancelled') {
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;
    }

    // For history or equal-priority active calls, newest event time first
    const timeA = new Date(a.completed_at || a.created_at).getTime();
    const timeB = new Date(b.completed_at || b.created_at).getTime();
    return timeB - timeA;
  });
}

