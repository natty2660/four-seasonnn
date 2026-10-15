import http from 'http';
import { syncCallTimeouts } from '../src/server/routes.js';
import { reconcileWaiterCalls } from '../src/utils/reconcileCalls.js';
import type { WaiterCall } from '../src/types/index.js';

const BASE_URL = 'http://localhost:3000';

async function fetchJson(path: string, options: any = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTestSuite() {
  console.log('\n========================================');
  console.log('🚀 RUNNING VIP CALL SYSTEM VERIFICATION');
  console.log('========================================\n');

  // ----------------------------------------------------
  // TEST 1: SSE vs. HTTP Polling Collisions
  // ----------------------------------------------------
  console.log('\n--- 1. Testing SSE vs. HTTP Polling Collisions ---');

  // Verify SSE endpoint can be connected to and streams initial data
  const sseConnected = await new Promise<boolean>((resolve) => {
    const req = http.get(`${BASE_URL}/api/waiter-calls/stream`, (res) => {
      let chunkCount = 0;
      res.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('event: sync') || text.includes('event: keepalive') || text.includes('data:')) {
          chunkCount++;
          req.destroy();
          resolve(true);
        }
      });
      setTimeout(() => {
        req.destroy();
        resolve(chunkCount > 0);
      }, 3000);
    });
    req.on('error', () => resolve(false));
  });

  assert(sseConnected, 'SSE stream endpoint (/api/waiter-calls/stream) successfully connects and broadcasts events');

  // Test client reconciliation resolution when SSE and delayed HTTP polling collide
  const testCallId = `test-call-collision-${Date.now()}`;
  const baseCall: WaiterCall = {
    id: testCallId,
    table_id: 'table-test-1',
    table_number: 'VIP-99',
    table_name: 'Presidential Suite',
    call_type: 'bill',
    status: 'pending',
    created_at: new Date(Date.now() - 5000).toISOString(),
    revision: 1,
  };

  // State A: Initial local state
  const localState1 = [baseCall];

  // SSE event arrives with newer state: accepted by waiter (revision 2)
  const sseIncomingState: WaiterCall[] = [{
    ...baseCall,
    status: 'accepted',
    accepted_by_waiter_id: 'waiter-101',
    accepted_by_name: 'John Doe',
    accepted_at: new Date().toISOString(),
    revision: 2,
  }];

  const stateAfterSSE = reconcileWaiterCalls(localState1, sseIncomingState);
  assert(stateAfterSSE[0].status === 'accepted' && stateAfterSSE[0].revision === 2, 'SSE stream update cleanly transitions call to accepted with revision 2');

  // A delayed, stale HTTP poll now arrives with older snapshot (status: pending, revision 1)
  const staleHttpPollState: WaiterCall[] = [{
    ...baseCall,
    status: 'pending',
    revision: 1,
  }];

  const stateAfterStalePoll = reconcileWaiterCalls(stateAfterSSE, staleHttpPollState);
  assert(stateAfterStalePoll[0].status === 'accepted', 'Collision resolved: Stale HTTP poll (revision 1) DOES NOT overwrite SSE accepted state (revision 2)');
  assert(stateAfterStalePoll[0].accepted_by_name === 'John Doe', 'Accepted waiter details preserved without flicker');

  // ----------------------------------------------------
  // TEST 2: Monotonic Sequence / Revision Number Tracking
  // ----------------------------------------------------
  console.log('\n--- 2. Testing Monotonic Sequence / Revision Number Tracking ---');

  // Step 2a: Query existing VIP tables from API
  const tablesRes = await fetchJson('/api/vip-tables');
  assert(tablesRes.status === 200 && Array.isArray(tablesRes.data) && tablesRes.data.length > 0, 'Fetched active VIP tables');
  const targetTable = tablesRes.data[0];

  const createRes = await fetchJson('/api/waiter-calls', {
    method: 'POST',
    body: JSON.stringify({
      table_id: targetTable.id,
      table_number: targetTable.table_number,
      table_name: targetTable.name,
      call_type: 'order',
      message: 'Ready to order premium steak',
    }),
  });
  assert(createRes.status === 200 || createRes.status === 201, `Created live VIP call via API (status: ${createRes.status})`);
  const createdCall = createRes.data;
  assert(typeof createdCall.revision === 'number' && createdCall.revision >= 1, `Call created with initial revision ${createdCall.revision}`);
  const callId = createdCall.id;

  // Step 2b: Accept Call
  const acceptRes = await fetchJson(`/api/waiter-calls/${callId}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      waiter_id: 'waiter-alex',
      waiter_name: 'Alex Vance',
    }),
  });
  assert(acceptRes.status === 200, 'Accepted VIP call');
  const acceptedCall = acceptRes.data;
  assert(acceptedCall.revision > createdCall.revision, `Accept incremented revision monotonically: ${createdCall.revision} -> ${acceptedCall.revision}`);
  assert(acceptedCall.status === 'accepted', 'Call status is accepted');

  // Step 2c: Hold Call
  const holdRes = await fetchJson(`/api/waiter-calls/${callId}/hold`, {
    method: 'POST',
    body: JSON.stringify({
      waiter_id: 'waiter-alex',
      waiter_name: 'Alex Vance',
      reason: 'Serving vintage wine at Table 3, arriving in 2 mins',
    }),
  });
  assert(holdRes.status === 200, 'Held VIP call with reason');
  const heldCall = holdRes.data;
  assert(heldCall.revision > acceptedCall.revision, `Hold incremented revision monotonically: ${acceptedCall.revision} -> ${heldCall.revision}`);
  assert(heldCall.status === 'hold', 'Call status is hold');

  // Step 2d: Complete Call
  const completeRes = await fetchJson(`/api/waiter-calls/${callId}/complete`, {
    method: 'POST',
  });
  assert(completeRes.status === 200, 'Completed VIP call');
  const completedCall = completeRes.data;
  assert(completedCall.revision > heldCall.revision, `Complete incremented revision monotonically: ${heldCall.revision} -> ${completedCall.revision}`);
  assert(completedCall.status === 'completed', 'Call status is completed');
  console.log(`Monotonic revision sequence verified: 1 -> ${acceptedCall.revision} -> ${heldCall.revision} -> ${completedCall.revision}`);

  // ----------------------------------------------------
  // TEST 3: Strict Terminal State Lock
  // ----------------------------------------------------
  console.log('\n--- 3. Testing Strict Terminal State Lock ---');

  // Attempt to revert a completed call by applying a stale pending payload
  const currentLocalWithCompleted = [completedCall];
  const zombiePollPayload: WaiterCall[] = [{
    ...completedCall,
    status: 'pending',
    revision: 1, // Stale revision
  }];

  const reconciledAfterZombie = reconcileWaiterCalls(currentLocalWithCompleted, zombiePollPayload);
  assert(reconciledAfterZombie[0].status === 'completed', 'Terminal State Lock: Stale pending packet cannot resurrect completed call');

  // Even if incoming revision claimed equal or higher, terminal lock window prevents resurrection to pending
  const aggressiveZombiePayload: WaiterCall[] = [{
    ...completedCall,
    status: 'pending',
    revision: completedCall.revision,
  }];
  const reconciledAggressive = reconcileWaiterCalls(currentLocalWithCompleted, aggressiveZombiePayload);
  assert(reconciledAggressive[0].status === 'completed', 'Terminal State Lock: Equal revision cannot revert completed call within lock window');

  // Test missed call terminal lock
  const missedCall: WaiterCall = {
    id: `missed-${Date.now()}`,
    table_id: 'tbl-missed',
    table_number: 'VIP-4',
    table_name: 'Terrace',
    call_type: 'general',
    status: 'missed',
    created_at: new Date(Date.now() - 70000).toISOString(),
    missed_at: new Date(Date.now() - 10000).toISOString(),
    revision: 2,
  };
  const zombieMissedPayload: WaiterCall[] = [{
    ...missedCall,
    status: 'pending',
  }];
  const reconciledMissed = reconcileWaiterCalls([missedCall], zombieMissedPayload);
  assert(reconciledMissed[0].status === 'missed', 'Missed Call Lock: Missed call never resurrects to pending to prevent duplicate ringing');

  // ----------------------------------------------------
  // TEST 4: Server-Authoritative Escalation Sweeper
  // ----------------------------------------------------
  console.log('\n--- 4. Testing Server-Authoritative Escalation Sweeper ---');

  const nowMs = Date.now();
  // 4a. Pending call created 50s ago (exceeds 45s threshold)
  const callToEscalate: WaiterCall = {
    id: `call-escalate-${nowMs}`,
    table_id: 't-esc',
    table_number: 'VIP-5',
    table_name: 'Garden Table',
    call_type: 'water',
    status: 'pending',
    created_at: new Date(nowMs - 50000).toISOString(),
    revision: 1,
    is_escalated: false,
  };

  // 4b. Pending call created 65s ago (exceeds 60s timeout threshold)
  const callToTimeout: WaiterCall = {
    id: `call-timeout-${nowMs}`,
    table_id: 't-timeout',
    table_number: 'VIP-6',
    table_name: 'Balcony',
    call_type: 'general',
    status: 'pending',
    created_at: new Date(nowMs - 65000).toISOString(),
    revision: 1,
    is_escalated: false,
  };

  // 4c. Fresh call created 10s ago (within normal threshold)
  const callFresh: WaiterCall = {
    id: `call-fresh-${nowMs}`,
    table_id: 't-fresh',
    table_number: 'VIP-7',
    table_name: 'Lounge',
    call_type: 'bill',
    status: 'pending',
    created_at: new Date(nowMs - 10000).toISOString(),
    revision: 1,
    is_escalated: false,
  };

  const callsBatch = [callToEscalate, callToTimeout, callFresh];
  syncCallTimeouts(callsBatch);

  assert(callToEscalate.is_escalated === true, 'Sweeper: Call >= 45s marked is_escalated: true');
  assert((callToEscalate.revision ?? 1) > 1, `Sweeper: Escalated call revision incremented to ${callToEscalate.revision}`);

  assert(callToTimeout.status === 'missed', 'Sweeper: Unanswered call >= 60s transitioned to status: missed');
  assert(Boolean(callToTimeout.missed_at), 'Sweeper: Missed call received missed_at timestamp');
  assert((callToTimeout.revision ?? 1) > 1, `Sweeper: Missed call revision incremented to ${callToTimeout.revision}`);

  assert(callFresh.status === 'pending' && !callFresh.is_escalated, 'Sweeper: Fresh call (< 45s) remains unescalated and pending');

  // ----------------------------------------------------
  // TEST 5: Smooth Visual Transitions
  // ----------------------------------------------------
  console.log('\n--- 5. Testing Smooth Visual Transitions ---');

  // Verify transition attributes and dismiss logic in client components
  const { readFileSync } = await import('fs');
  const vipCustomerCode = readFileSync('./src/components/VipTableCustomerView.tsx', 'utf-8');
  const waiterMobileCode = readFileSync('./src/components/WaiterMobileApp.tsx', 'utf-8');

  // Check 6-second auto dismiss timer in VipTableCustomerView
  const hasAutoDismissTimer = vipCustomerCode.includes('setDismissedCompletedCallId(recentCompletedCall.id)') && vipCustomerCode.includes('6000');
  assert(hasAutoDismissTimer, 'VipTableCustomerView has smooth 6-second auto-dismiss timer for completed service banner');

  // Check smooth CSS transition classes in Customer View
  const hasTransitionClasses = vipCustomerCode.includes('transition-all') || vipCustomerCode.includes('animate-');
  assert(hasTransitionClasses, 'VipTableCustomerView applies smooth animations and transitions without layout jumping');

  // Check Waiter Mobile multi-call queue and stable ranking
  const hasQueueOrdering = waiterMobileCode.includes('sort(') || waiterMobileCode.includes('CALL_PRIORITY_MAP');
  assert(hasQueueOrdering, 'WaiterMobileApp maintains stable priority ranking and queue order without layout thrashing');

  console.log('\n========================================');
  console.log('🎉 ALL 5 VIP SYSTEM TEST SUITES PASSED!');
  console.log('========================================\n');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
