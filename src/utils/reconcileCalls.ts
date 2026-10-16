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

  // 1. Process all incoming calls
  for (const inc of incomingList) {
    mergedMap.set(inc.id, {
      ...inc,
      revision: inc.revision ?? 1,
    });
  }

  // 2. Preserve optimistic local states if newer
  const now = Date.now();
  for (const loc of localList) {
    const inc = mergedMap.get(loc.id);
    if (!inc) {
      // If local call is still active and recently created, don't drop it immediately
      if (loc.status === 'pending' || loc.status === 'accepted' || loc.status === 'hold') {
        const timeRef = new Date(loc.created_at).getTime();
        if (now - timeRef < 30000) {
          mergedMap.set(loc.id, loc);
        }
      } else if (loc.status === 'completed' || loc.status === 'cancelled') {
        // Also preserve recently completed/cancelled calls in history for at least 60s
        const timeRef = new Date(loc.completed_at || loc.created_at).getTime();
        if (now - timeRef < 60000) {
          mergedMap.set(loc.id, loc);
        }
      }
    } else {
      const locRev = loc.revision || 1;
      const incRev = inc.revision || 1;

      // Retain local state if the local revision is strictly newer
      if (locRev > incRev) {
        mergedMap.set(loc.id, loc);
        continue;
      }

      // Retain local state if local was modified more recently within a 10-second window
      const locTime = new Date(loc.completed_at || loc.accepted_at || loc.held_at || loc.created_at).getTime();
      const incTime = new Date(inc.completed_at || inc.accepted_at || inc.held_at || inc.created_at).getTime();
      if (locRev === incRev && locTime > incTime && now - locTime < 10000) {
        mergedMap.set(loc.id, loc);
        continue;
      }

      // Retain local terminal state if completed/cancelled locally within last 20 seconds
      const locIsTerminal = loc.status === 'completed' || loc.status === 'cancelled';
      const incIsActive = inc.status === 'pending' || inc.status === 'accepted' || inc.status === 'hold';
      if (locIsTerminal && incIsActive && now - locTime < 20000) {
        mergedMap.set(loc.id, loc);
        continue;
      }
    }
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

