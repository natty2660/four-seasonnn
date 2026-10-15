# VIP Call State Synchronization & Flicker Elimination Plan

Eliminate call flickering, unexpected appearance/disappearance, and state reversions across VIP table customer views, waiter mobile apps, and administrative dispatch terminals.

## Root Cause Analysis: Why Calls Appear, Disappear, or Revert

Through codebase analysis across client and server tiers, four distinct mechanisms were identified that trigger flickering and disappearing calls:

1. **SSE vs. HTTP Polling Collisions**: The client maintains an active Server-Sent Events (SSE) stream (`/api/waiter-calls/stream`) while simultaneously running an aggressive 2.5s `setInterval` HTTP polling loop. When an SSE event delivers a fresh status change (e.g. `accepted`), an in-flight or cached HTTP poll response dispatched milliseconds earlier returns the previous `pending` state, temporarily reverting the UI and causing the call to reappear as ringing before flipping back.
2. **Missing Monotonic Revision / Epoch Numbers**: Call updates only track string timestamps without a strict monotonic sequence number (`revision` or `version`). Out-of-order network responses can cause older state snapshots to overwrite newer ones.
3. **Escalation Boundary Jumping**: Waiters evaluate `45000ms` auto-escalation locally on every clock tick. If a call is assigned to another waiter, it is hidden from other staff for 44 seconds, suddenly pops onto every phone at second 45, and disappears if the assigned waiter takes action or the timer fluctuates.
4. **Local Reconciliation Resurrection**: The client reconciliation logic preserves historical calls locally; when a call is completed or dismissed, stale entries can be resurrected if an incoming backend snapshot lacks synchronization markers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Current Conflicting Flow                         │
└────────────────────────────────────────────────────────────────────────┘
 [VIP Customer] ────► POST /api/waiter-calls ───► Server State (Revision 1)
                                                         │
   ┌─────────────────────────────────────────────────────┴─────────────┐
   │ Real-time SSE Stream (Instant)       HTTP Polling (2.5s Delay)    │
   ▼                                      ▼                            │
 [Waiter App] ◄── Status: "accepted"      Stale Status: "pending" ─────┘
   │                                      │
   └────────── State oscillates / flickers / re-rings ─────────────────┘
```

---

## User Review & Critical Decisions

> [!IMPORTANT]
> To permanently eliminate flickering while ensuring zero missed customer calls, the following architectural decisions are established:

- **Authoritative Stream-First Model**: The Server-Sent Events (SSE) stream becomes the primary authoritative real-time channel. Background HTTP polling is demoted to a fallback health check that only fires if the SSE connection drops.
- **Monotonic Sequence / Revision Counter**: Every call mutation increments a server-authoritative `revision` integer. Clients reject any incoming call snapshot whose `revision` is lower than the locally confirmed state.
- **Strict Terminal State Lock**: Once a call reaches a resolved status (`accepted`, `completed`, `cancelled`), it is mathematically locked and cannot revert to `pending` or re-ring under any network condition.
- **Smooth Visual Exit Transitions**: Calls transitioning to `completed` or `missed` will not abruptly vanish; they will transition through a dedicated 5-second status card with clear visual feedback before moving to the historical record.

---

## 1. Overview & Core Concept

- **What It Does**: Establishes a deterministic, flicker-free state lifecycle for all VIP table service calls. A customer calling for assistance, bill, water, or order experiences immediate, stable feedback (`Paging Staff` → `Waiter Accepted & On the Way` → `Service Completed`), while floor waiters receive synchronized, non-duplicating alerts.
- **Target Audience**: VIP table guests demanding prompt, reassuring hospitality feedback, and floor waiters operating under rapid restaurant conditions.
- **Key Value**: Eliminates ghost rings, disappearing alerts, and double-attendance by multiple waiters.

---

## 2. User Experience & Visual Design

### Deterministic Call Lifecycle & Visual Stages

```
┌───────────┐    Waiter Accepts     ┌───────────┐    Waiter Finishes    ┌───────────┐
│  PENDING  │ ────────────────────► │ ACCEPTED  │ ────────────────────► │ COMPLETED │
└─────┬─────┘                       └─────┬─────┘                       └───────────┘
      │                                   │
      │ 45s Escalation                    │ Waiter Attending Other Table
      ▼                                   ▼
┌───────────┐                       ┌───────────┐
│ ESCALATED │                       │   HOLD    │
└───────────┘                       └───────────┘
```

1. **Stage 1 — Instant Paging (`pending`)**:
   - Customer UI: Glowing gold pulsing banner with assigned waiter name and live elapsed seconds.
   - Waiter UI: High-priority ring alert with prominent table badge and priority tag (P1–P5).
2. **Stage 2 — Waiter Accepted (`accepted`)**:
   - Customer UI: Seamlessly transitions to emerald green banner: *"Staff Member [Name] is on the way to Table [Number]"*. A pleasant audio chime confirms acceptance.
   - Waiter UI: Ringtone silences instantly; call card transitions to "In Progress" with action button *"Mark Service Completed"*.
3. **Stage 3 — Queue Hold (`hold`)**:
   - Customer UI: Amber status banner: *"Staff is currently assisting Table [X] and will attend to you next (Queue Position #1)"*.
   - Waiter UI: Clearly marked in the Queued / Hold tray with 1-tap promotion.
4. **Stage 4 — Smooth Completion (`completed`)**:
   - Customer UI: Smooth 5-second checkmark confirmation: *"Service Completed. Thank you!"* before returning gracefully to standard menu browsing.
   - Waiter UI: Slides cleanly into the recent completed drawer without layout shift.

---

## 3. Key Technical Decisions & Trade-Offs

- **Decision 1: SSE Primary with Disconnect-Only Polling Fallback**
  - *Chosen Approach*: When SSE connection is `OPEN`, disable HTTP call polling completely. If the SSE stream disconnects or errors, smoothly activate a 5-second poll until SSE reconnects.
  - *Why*: Eliminates out-of-order race conditions where stale HTTP poll responses overwrite fresher SSE broadcast events.
- **Decision 2: Monotonic Call Revisions (`revision: number`)**
  - *Chosen Approach*: Every call record carries an integer `revision` (incremented on every status update or assignment).
  - *Why*: Provides deterministic conflict resolution (`newCall.revision > prevCall.revision`).
- **Decision 3: Server Authoritative Timeout Sweeper**
  - *Chosen Approach*: The server alone decides when a call transitions from `pending` to `missed` or `escalated`. Clients do not calculate status flips independently on clock ticks.
  - *Why*: Prevents client-server clock drift from causing calls to flicker into escalation and back.
- **Decision 4: Database Mutex & Atomic Transactions**
  - *Chosen Approach*: Maintain atomic serialization on mutations (`mutateDatabaseAsync`) so simultaneous accepts, holds, and calls never produce orphaned writes.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Synchronized Architecture Flow                     │
└────────────────────────────────────────────────────────────────────────┘

  [Customer View]             [Backend Server]              [Waiter App]
         │                            │                           │
         │  1. POST /api/waiter-calls │                           │
         ├───────────────────────────►│ (Assigns rev=1, pending)  │
         │                            │                           │
         │                            │  2. SSE Event (rev=1)     │
         │◄───────────────────────────┼──────────────────────────►│ (Rings)
         │   (Status: Paging)         │                           │
         │                            │  3. POST /accept (rev=2)  │
         │                            │◄──────────────────────────┤
         │                            │ (Locks rev=2, accepted)   │
         │                            │                           │
         │  4. SSE Broadcast (rev=2)  │                           │
         │◄───────────────────────────┴──────────────────────────►│
         │   (Chimes: Waiter on way)                              │ (Silences ring)
```

### State Store Structure & Interface Updates

```typescript
export interface WaiterCall {
  id: string;
  table_id: string;
  table_number: string;
  table_name: string;
  call_type: CallType;
  message?: string;
  status: CallStatus; // 'pending' | 'accepted' | 'hold' | 'missed' | 'completed' | 'cancelled'
  assigned_waiter_id: string | null;
  accepted_by_waiter_id?: string | null;
  accepted_by_name?: string | null;
  is_escalated: boolean;
  revision: number; // Monotonically increasing version counter
  created_at: string;
  accepted_at?: string | null;
  held_at?: string | null;
  completed_at?: string | null;
  missed_at?: string | null;
}
```

### Component & File Work Plan

1. **Server Core (`src/server/routes.ts` & `src/server/db.ts`)**:
   - Add monotonic `revision` tracking to all call creations, accepts, holds, completions, and timeouts.
   - Unify escalation and timeout calculation strictly on the server background worker.
   - Streamline SSE broadcast payload to include the authoritative revision.
2. **Client State Engine (`src/App.tsx`)**:
   - Update `reconcileWaiterCalls` to use strict revision comparison (`incoming.revision >= prev.revision`).
   - Implement smart SSE stream manager that suspends background HTTP polling while SSE is actively receiving heartbeats.
   - Ensure local optimistic actions carry an incremented revision so incoming stale responses cannot revert them.
3. **Waiter Terminal UI (`src/components/WaiterMobileApp.tsx` & `NativeIncomingCallScreen.tsx`)**:
   - Stabilize active call filtering against server-driven `is_escalated` flags instead of local clock drift.
   - Preserve completed calls in the historical drawer with smooth exit animations.
4. **Customer VIP Experience (`src/components/VipTableCustomerView.tsx`)**:
   - Smooth out the transition between active calls and recent completions so the card never flashes or disappears prematurely.

---

## Verification & Testing Plan

1. **Concurrent Multi-Device Test**: Open Customer Table view and Waiter App in separate windows; trigger calls, accepts, and holds; verify 0 flickering.
2. **SSE vs. Polling Resilience**: Simulate network latency on polling and confirm SSE updates always take precedence without reversal.
3. **Timeout & Escalation Verification**: Observe a 45s escalation and 60s timeout to verify state changes cleanly without bounce.
4. **Compilation & Lint Verification**: Run `compile_applet` and `lint_applet` to confirm clean TypeScript compilation.
