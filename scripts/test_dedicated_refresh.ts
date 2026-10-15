import { reconcileWaiterCalls } from '../src/utils/reconcileCalls.ts';
import type { WaiterCall } from '../src/types/index.ts';

console.log('========================================');
console.log('🔄 TESTING DEDICATED 5-SECOND REFRESH SYSTEM');
console.log('========================================');

// Test 1: Simulating status progression across consecutive 5-second polling intervals
console.log('\n--- 1. Testing 5-Second Cycle Status Transition Reconciliation ---');

const initialCall: WaiterCall = {
  id: 'call_test_5s_1',
  table_id: 'vip_1',
  table_number: 'VIP 1',
  table_name: 'Presidential Suite',
  call_type: 'urgent',
  status: 'pending',
  revision: 1,
  created_at: new Date(Date.now() - 10000).toISOString(),
  assigned_waiter_id: 'waiter_1',
  is_escalated: false,
};

let clientState: WaiterCall[] = [initialCall];

// Cycle 1 (T+5s): Server updates status to 'accepted' by Waiter Abebe with revision 2
const serverUpdateCycle1: WaiterCall = {
  ...initialCall,
  status: 'accepted',
  accepted_by_waiter_id: 'waiter_1',
  accepted_by_name: 'Abebe Bikila',
  accepted_at: new Date().toISOString(),
  revision: 2,
};

clientState = reconcileWaiterCalls(clientState, [serverUpdateCycle1]);
if (clientState[0].status === 'accepted' && clientState[0].accepted_by_name === 'Abebe Bikila') {
  console.log('✅ PASSED: 5s Cycle 1 successfully transitioned pending -> accepted');
} else {
  console.error('❌ FAILED: 5s Cycle 1 status incorrect:', clientState[0]);
  process.exit(1);
}

// Cycle 2 (T+10s): Server places call on hold with revision 3
const serverUpdateCycle2: WaiterCall = {
  ...serverUpdateCycle1,
  status: 'hold',
  held_at: new Date().toISOString(),
  hold_reason: 'Attending another table',
  revision: 3,
};

clientState = reconcileWaiterCalls(clientState, [serverUpdateCycle2]);
if (clientState[0].status === 'hold' && clientState[0].hold_reason === 'Attending another table') {
  console.log('✅ PASSED: 5s Cycle 2 successfully transitioned accepted -> hold');
} else {
  console.error('❌ FAILED: 5s Cycle 2 status incorrect:', clientState[0]);
  process.exit(1);
}

// Cycle 3 (T+15s): Server completes call with revision 4
const serverUpdateCycle3: WaiterCall = {
  ...serverUpdateCycle2,
  status: 'completed',
  completed_at: new Date().toISOString(),
  revision: 4,
};

clientState = reconcileWaiterCalls(clientState, [serverUpdateCycle3]);
if (clientState[0].status === 'completed') {
  console.log('✅ PASSED: 5s Cycle 3 successfully transitioned hold -> completed');
} else {
  console.error('❌ FAILED: 5s Cycle 3 status incorrect:', clientState[0]);
  process.exit(1);
}

// Cycle 4 (T+20s): Stale network response arrives with older pending status (revision 1)
const staleResponse: WaiterCall = {
  ...initialCall,
  revision: 1,
};

clientState = reconcileWaiterCalls(clientState, [staleResponse]);
if (clientState[0].status === 'completed') {
  console.log('✅ PASSED: Stale packet rejected; completed terminal status remains locked in 5s refresh');
} else {
  console.error('❌ FAILED: Stale packet overwrote completed call:', clientState[0]);
  process.exit(1);
}

console.log('\n========================================');
console.log('🎉 DEDICATED 5-SECOND REFRESH ENGINE VERIFIED!');
console.log('========================================');
