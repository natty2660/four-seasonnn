# Four Season VIP Table Call Lifecycle Diagnostic & Verification Guide

This guide details the complete, production-grade diagnostic testing process for the **VIP Table Customer to Waiter Dispatch System**. It provides step-by-step instructions for verifying all state transitions, audio-visual feedback, timers, and automatic dismissals across both the customer mobile view and the waiter terminal.

---

## 1. System Architecture & State Transition Lifecycle

The VIP Call system is authoritative, real-time, and resilient against network interruptions or browser reloads. Calls transition through a strict finite state machine with monotonic revisions:

```text
 ┌───────────────────────┐
 │   READY FOR SERVICE   │  (Customer browses luxury menu; no active call)
 └──────────┬────────────┘
            │ Customer taps call button (Water, Waiter, Bill, Food)
            ▼
 ┌───────────────────────┐  • Customer: Pulsing Amber banner + glowing bell
 │        PENDING        │  • Waiter: Loud repeating chime + VIP alert modal
 └─────┬───────────┬─────┘  • Revision: 1
       │           │
       │ Waiter clicks "Hold"
       │           ▼
       │  ┌───────────────────────┐  • Customer: Soft Blue "On Queue" banner
       │  │         HOLD          │    + personalized reassurance reason
       │  └────────┬──────────────┘  • Waiter: Audio silenced + moved to Queued list
       │           │ Waiter clicks "Resume & Accept"
       ▼           ▼
 ┌───────────────────────┐  • Customer: Rich Emerald Green "Waiter On The Way"
 │       ACCEPTED        │    + dedicated waiter name & photo attribution
 └──────────┬────────────┘  • Waiter: Active Task timer counts elapsed seconds
            │
            │ Waiter clicks "Mark Completed" (or Customer cancels)
            ▼
 ┌───────────────────────┐  • Customer: Golden checkmark "Service Completed"
 │       COMPLETED       │    + smooth auto-dismissal after 6 seconds
 └───────────────────────┘  • Waiter: Archived in Recent History log with duration
```

---

## 2. Automated & Interactive CLI Diagnostic Test

The system includes a pre-configured, automated test suite in `scripts/diagnostic_call_lifecycle.ts` that exercises the real backend APIs, tests every state transition, validates database persistence, and checks that monotonic revisions increment properly.

### How to Run:

```bash
# 1. Interactive Visual Stepped Mode (2.5s pauses per step so you can watch split browser windows live)
npm run test:call

# 2. Fast Automated Mode (runs in ~1.5s for CI / quick validation)
npm run test:call -- --quick
```

### What the Diagnostic Script Validates:
1. **Pre-flight Check**: Queries `/api/vip-tables` and `/api/waiters` to ensure active table and on-duty waiter profiles exist.
2. **Step 1 (Pending)**: POSTs `/api/waiter-calls` with call type (`bill`), priority weight, and notes. Verifies response status `pending` and initial `revision: 1`.
3. **Step 2 (Hold)**: POSTs `/api/waiter-calls/:id/hold` with `waiter_id` and custom hold reason. Verifies response status `hold`, hold reason string, and monotonic revision increment (`revision: 2`).
4. **Step 3 (Accepted)**: POSTs `/api/waiter-calls/:id/accept` with waiter attribution. Verifies response status `accepted`, waiter name binding, `accepted_at` timestamp, and monotonic revision (`revision: 3`).
5. **Step 4 (Completed)**: POSTs `/api/waiter-calls/:id/complete`. Verifies response status `completed`, `completed_at` timestamp, release of waiter capacity, and revision increment (`revision: 4`).
6. **Step 5 (Cancelled)**: Creates a new pending request and cancels it via `/api/waiter-calls/:id/cancel`. Verifies instant cancellation and audio release.

---

## 3. Dual-Screen Manual Live Verification Walkthrough

To observe the full visual and audio experience simultaneously, open two side-by-side browser windows:

| Screen | Target URL | Notes |
| :--- | :--- | :--- |
| **Window A: VIP Customer** | `http://localhost:3000/vip?table=VIP-1&entry=qr&scan=camera` | Simulates guest scanning physical table stand QR code |
| **Window B: Waiter Terminal** | `http://localhost:3000/waiter-app` | Staff portal (Default staff PIN: `1234`) |
| **Window C: Admin Overview** | `http://localhost:3000/admin` | Optional (Admin Password: `fourseason2026`) |

---

### Step-by-Step UI Verification Checklist

#### Step 1: Customer Presses Call Button
1. In **Window A (Customer)**, scroll to the quick-call action buttons (e.g. **"Call Waiter"**, **"Request Bill"**, or **"Water Refill"**) and click one.
2. **Verify Customer View (Window A)**:
   - [ ] Soft haptic/audio confirmation chime plays.
   - [ ] The call button shows an active calling indicator to prevent duplicate spam taps.
   - [ ] Top banner transforms to **pulsing amber / gold glow** with a swinging bell animation.
   - [ ] Status reads: `"Paging Waiter • VIP High Priority"`.
   - [ ] A **"Cancel Request"** button appears.
3. **Verify Waiter Terminal (Window B)**:
   - [ ] Waiter terminal triggers native repeating restaurant chime and vibration.
   - [ ] Full-screen **Incoming VIP Call Alert Modal** pops up with:
     - Table Number: `VIP-1` (Gold badge)
     - Table Name: `Royal Gold Suite`
     - Call Type: e.g. `BILL` or `WAITER`
     - Prominent **"Accept"** and **"Hold / Queue"** buttons.
   - [ ] Call appears at the top of the **Active Dispatch List** sorted by VIP priority.

---

#### Step 2: Waiter Acknowledges with "Hold"
1. In **Window B (Waiter)**, click **"Hold"** (or select a hold reason such as *"Attending Table 3, arriving in 2 mins"*).
2. **Verify Customer View (Window A)**:
   - [ ] Amber pulsing banner immediately transitions to a **calming blue status card**.
   - [ ] Status reads: `"On Queue • Staff Acknowledged"`.
   - [ ] Custom message displays clearly: *"Attending Table 3, arriving in 2 mins"*.
   - [ ] The bell icon pulse slows to reassure the customer that their request is in progress.
3. **Verify Waiter Terminal (Window B)**:
   - [ ] The continuous repeating chime silences.
   - [ ] The call card moves into the **"On Hold / Queued Tasks"** section.
   - [ ] Shows a waiting duration timer and a **"Resume & Accept"** action button.

---

#### Step 3: Waiter Accepts the Call
1. In **Window B (Waiter)**, click **"Accept"** (or **"Resume & Accept"**).
2. **Verify Customer View (Window A)**:
   - [ ] Status banner transitions to **rich emerald green**: `"Waiter On The Way"`.
   - [ ] Displays the assigned staff member's name (e.g. `VIP Reservation Desk` or `Martha`).
   - [ ] Shows exact time of acceptance (e.g. `Just now` / timestamp).
3. **Verify Waiter Terminal (Window B)**:
   - [ ] Call card displays under **"Active Attending Tasks"** with emerald glow.
   - [ ] Live elapsed service timer starts counting up (e.g. `00:15`, `00:16`...).
   - [ ] Action button switches to **"Mark Service Completed"**.

---

#### Step 4: Waiter Marks Service Completed
1. In **Window B (Waiter)**, click **"Mark Service Completed"**.
2. **Verify Customer View (Window A)**:
   - [ ] Banner changes to a golden confirmation card with a checkmark: `"Service Completed. Thank you!"`.
   - [ ] Smooth **6-second auto-dismissal**: The card automatically fades out smoothly after 6 seconds without any abrupt page jumps.
   - [ ] Call buttons return to default ready state.
3. **Verify Waiter Terminal (Window B)**:
   - [ ] Card exits active dispatch list smoothly.
   - [ ] Call is archived into the **"Recent Completed Calls"** history log with total duration recorded.
   - [ ] If another table was queued on hold, it automatically dispatches to the waiter.

---

#### Step 5: Customer Cancellation Edge Case
1. In **Window A (Customer)**, press any call button to initiate a new call.
2. Immediately click **"Cancel Request"** on the customer banner.
3. **Verify**:
   - [ ] Customer alert banner immediately dismisses without flicker.
   - [ ] Waiter terminal chime stops instantly.
   - [ ] Incoming alert modal closes cleanly on the waiter terminal with zero residual zombie notifications.

---

## 4. Multi-Table Queue & Concurrency Rule Verification

The system enforces strict concurrency guards:
1. **Single Attending Limit**: If a waiter is already attending Table `VIP-1`, and they click "Accept" on Table `VIP-2`, the backend automatically places `VIP-2` on **Hold** with reason: *"Staff is attending Table VIP-1"*.
2. **Automatic Promotion**: When the waiter completes service on `VIP-1`, the system automatically promotes the oldest held call (`VIP-2`) from **Hold** back to **Pending / Accepted**, ensuring no customer is left behind.

---

## 5. Summary of Diagnostic Commands

| Command | Action |
| :--- | :--- |
| `npm run test:call` | Runs interactive stepped lifecycle test with 2.5s visual pauses |
| `npm run test:call -- --quick` | Runs rapid 1.5s automated verification of all 5 transitions |
| `npm run lint` | Runs `tsc --noEmit` type verification |
| `npm run build` | Compiles production Vite client bundle |
| `npm run dev` | Starts server on `http://localhost:3000` |
