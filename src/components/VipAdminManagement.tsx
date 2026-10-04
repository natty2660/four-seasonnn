import React, { useState } from 'react';
import { VipTable, Waiter, WaiterCall } from '../types/index.ts';
import { generateQRCodeDataUrl, getVipTableUrl } from '../lib/qr.ts';
import {
  Crown,
  Bell,
  BellRing,
  UserCheck,
  UserPlus,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  QrCode,
  Download,
  Printer,
  Shield,
  Phone,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  X,
} from 'lucide-react';

interface VipAdminManagementProps {
  vipTables: VipTable[];
  waiters: Waiter[];
  calls: WaiterCall[];
  token: string;
  onUpdateTables: (tables: VipTable[]) => void;
  onUpdateWaiters: (waiters: Waiter[]) => void;
  onAcceptCall: (callId: string, waiterId: string, waiterName: string) => Promise<void>;
  onCompleteCall: (callId: string) => Promise<void>;
  onCancelCall: (callId: string) => Promise<void>;
}

export const VipAdminManagement: React.FC<VipAdminManagementProps> = ({
  vipTables,
  waiters,
  calls,
  token,
  onUpdateTables,
  onUpdateWaiters,
  onAcceptCall,
  onCompleteCall,
  onCancelCall,
}) => {
  const [activeTab, setActiveTab] = useState<'calls' | 'tables' | 'waiters'>('calls');

  // Modal states
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isAddWaiterOpen, setIsAddWaiterOpen] = useState(false);
  const [selectedQRTable, setSelectedQRTable] = useState<VipTable | null>(null);
  const [qrModalDataUrl, setQrModalDataUrl] = useState<string>('');

  // Table form state
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableCode, setNewTableCode] = useState('');
  const [newTableWaiterId, setNewTableWaiterId] = useState('');
  const [newTableNotes, setNewTableNotes] = useState('');

  // Waiter form state
  const [newWaiterName, setNewWaiterName] = useState('');
  const [newWaiterPin, setNewWaiterPin] = useState('1234');
  const [newWaiterPhone, setNewWaiterPhone] = useState('');

  // API Call handlers
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    try {
      const res = await fetch('/api/vip-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          table_number: newTableNumber.trim().toUpperCase(),
          name: newTableName.trim() || `VIP Table ${newTableNumber.trim().toUpperCase()}`,
          secret_code: newTableCode.trim() || undefined,
          assigned_waiter_id: newTableWaiterId || null,
          notes: newTableNotes.trim(),
        }),
      });

      if (res.ok) {
        const created: VipTable = await res.json();
        onUpdateTables([...vipTables, created]);
        setIsAddTableOpen(false);
        setNewTableNumber('');
        setNewTableName('');
        setNewTableCode('');
        setNewTableWaiterId('');
        setNewTableNotes('');
      }
    } catch (err) {
      console.error('Failed to add VIP table:', err);
    }
  };

  const handleUpdateTableWaiter = async (tableId: string, assignedWaiterId: string | null) => {
    try {
      const res = await fetch(`/api/vip-tables/${tableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assigned_waiter_id: assignedWaiterId || null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdateTables(vipTables.map((t) => (t.id === tableId ? updated : t)));
      }
    } catch (err) {
      console.error('Failed to update table assignment:', err);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this VIP table?')) return;
    try {
      const res = await fetch(`/api/vip-tables/${tableId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onUpdateTables(vipTables.filter((t) => t.id !== tableId));
      }
    } catch (err) {
      console.error('Failed to delete table:', err);
    }
  };

  const handleAddWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaiterName.trim()) return;

    try {
      const res = await fetch('/api/waiters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newWaiterName.trim(),
          pin: newWaiterPin.trim() || '1234',
          phone: newWaiterPhone.trim() || undefined,
          is_on_duty: true,
        }),
      });

      if (res.ok) {
        const created: Waiter = await res.json();
        onUpdateWaiters([...waiters, created]);
        setIsAddWaiterOpen(false);
        setNewWaiterName('');
        setNewWaiterPin('1234');
        setNewWaiterPhone('');
      }
    } catch (err) {
      console.error('Failed to add waiter:', err);
    }
  };

  const handleToggleWaiterDuty = async (waiterId: string, currentDuty: boolean) => {
    try {
      const res = await fetch(`/api/waiters/${waiterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_on_duty: !currentDuty }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdateWaiters(waiters.map((w) => (w.id === waiterId ? updated : w)));
      }
    } catch (err) {
      console.error('Failed to toggle duty:', err);
    }
  };

  const handleDeleteWaiter = async (waiterId: string) => {
    if (!confirm('Are you sure you want to delete this waiter?')) return;
    try {
      const res = await fetch(`/api/waiters/${waiterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onUpdateWaiters(waiters.filter((w) => w.id !== waiterId));
        // Also unassign from table local state
        onUpdateTables(
          vipTables.map((t) =>
            t.assigned_waiter_id === waiterId ? { ...t, assigned_waiter_id: null } : t
          )
        );
      }
    } catch (err) {
      console.error('Failed to delete waiter:', err);
    }
  };

  const handleOpenTableQR = async (table: VipTable) => {
    setSelectedQRTable(table);
    const tableUrl = getVipTableUrl(table.table_number);
    try {
      const dataUrl = await generateQRCodeDataUrl({
        url: tableUrl,
        size: 1024,
        darkColor: '#0A0A0A',
        lightColor: '#FBF5B7',
      });
      setQrModalDataUrl(dataUrl);
    } catch {
      // Ignore
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all completed call logs?')) return;
    try {
      await fetch('/api/waiter-calls/history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const pendingCalls = calls.filter((c) => c.status === 'pending');
  const acceptedCalls = calls.filter((c) => c.status === 'accepted');
  const pastCalls = calls.filter((c) => c.status === 'completed' || c.status === 'cancelled');

  return (
    <div className="space-y-6">
      {/* Subnavigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/30 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'calls'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-[#FCF6BA] hover:bg-[#222]'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>Live VIP Calls</span>
            {pendingCalls.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                {pendingCalls.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'tables'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-[#FCF6BA] hover:bg-[#222]'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>VIP Tables ({vipTables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waiters')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'waiters'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-[#FCF6BA] hover:bg-[#222]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Staff Waiters ({waiters.length})</span>
          </button>
        </div>

        {activeTab === 'tables' && (
          <button
            onClick={() => setIsAddTableOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Add VIP Table</span>
          </button>
        )}

        {activeTab === 'waiters' && (
          <button
            onClick={() => setIsAddWaiterOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-1.5 shadow"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Waiter</span>
          </button>
        )}

        {activeTab === 'calls' && pastCalls.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs border border-white/10 transition-colors"
          >
            Clear Completed History
          </button>
        )}
      </div>

      {/* 1. LIVE VIP CALLS TAB */}
      {activeTab === 'calls' && (
        <div className="space-y-6">
          {/* PENDING CALLS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <BellRing className="w-4 h-4 animate-bounce" />
                Active Incoming Calls ({pendingCalls.length})
              </h3>
              <span className="text-xs text-white/50">Admin Live Overview</span>
            </div>

            {pendingCalls.length === 0 ? (
              <div className="p-6 text-center bg-[#111] border border-white/10 rounded-2xl text-xs text-white/60">
                No active pending calls right now. VIP tables are calm and attended.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingCalls.map((call) => {
                  const assignedWaiter = waiters.find((w) => w.id === call.assigned_waiter_id);
                  return (
                    <div
                      key={call.id}
                      className="p-5 rounded-2xl bg-[#1c140a] border-2 border-amber-500 shadow-xl shadow-amber-950/40 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-lg text-[#FCF6BA]">
                              {call.table_number}
                            </span>
                            <span className="font-bold text-sm text-white/90">
                              {call.table_name}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                            Call Type: {call.call_type}
                          </span>
                        </div>

                        <span className="text-xs text-white/60 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {new Date(call.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      {call.message && (
                        <div className="p-2.5 bg-black/40 rounded-xl border border-amber-500/20 text-xs text-amber-200 mb-3">
                          &ldquo;{call.message}&rdquo;
                        </div>
                      )}

                      <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs">
                          <span className="text-white/60 block text-[10px]">Responsible Waiter:</span>
                          <span className="font-bold text-[#FCF6BA]">
                            {assignedWaiter ? assignedWaiter.name : 'Unassigned (General Pool)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              onAcceptCall(
                                call.id,
                                assignedWaiter?.id || 'admin',
                                assignedWaiter?.name || 'Admin Host'
                              )
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1 shadow cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => onCancelCall(call.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-colors cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* IN-PROGRESS ACCEPTED CALLS */}
          {acceptedCalls.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                In Progress / Being Attended ({acceptedCalls.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {acceptedCalls.map((call) => (
                  <div
                    key={call.id}
                    className="p-4 rounded-xl bg-[#121812] border border-emerald-500/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#FCF6BA]">
                          {call.table_number}
                        </span>
                        <span className="text-white/90">{call.table_name}</span>
                        <span className="text-emerald-400 font-semibold">({call.call_type})</span>
                      </div>
                      <span className="text-[11px] text-white/60 mt-1 block">
                        Attended by: <strong className="text-white">{call.accepted_by_name}</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => onCompleteCall(call.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold hover:bg-emerald-900 cursor-pointer"
                    >
                      Complete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RECENT COMPLETED */}
          {pastCalls.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50 mb-3">
                Recent Call History ({pastCalls.length}):
              </h3>
              <div className="space-y-2">
                {pastCalls.slice(0, 8).map((call) => (
                  <div
                    key={call.id}
                    className="p-3 bg-[#111] border border-white/5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white/80">{call.table_number}</span>
                      <span className="text-white/60">{call.table_name}</span>
                      <span className="text-white/40">({call.call_type})</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold ${
                          call.status === 'completed' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {call.status === 'completed'
                          ? `Completed by ${call.accepted_by_name || 'Staff'}`
                          : 'Cancelled'}
                      </span>
                      <span className="text-[10px] text-white/40 block">
                        {new Date(call.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. VIP TABLES MANAGER TAB */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#EDEDED]">
                <thead className="bg-[#0e0e0e] text-[#D4AF37] uppercase font-bold text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th className="p-3.5">Table #</th>
                    <th className="p-3.5">Name / Location</th>
                    <th className="p-3.5">Responsible Waiter</th>
                    <th className="p-3.5">Access PIN</th>
                    <th className="p-3.5 text-center">QR Code</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {vipTables.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5 font-mono font-black text-[#FCF6BA]">
                        {t.table_number}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-white">{t.name}</div>
                        {t.notes && <div className="text-[10px] text-white/50">{t.notes}</div>}
                      </td>
                      <td className="p-3.5">
                        {/* Dropdown to change responsible waiter on the fly! */}
                        <select
                          value={t.assigned_waiter_id || ''}
                          onChange={(e) => handleUpdateTableWaiter(t.id, e.target.value || null)}
                          className="bg-[#1e1e1e] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37]"
                        >
                          <option value="">Unassigned (General Pool)</option>
                          {waiters.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} {w.is_on_duty ? '(On Duty)' : '(Off)'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 font-mono text-amber-300">
                        {t.secret_code ? t.secret_code : <span className="text-white/30">None (Open)</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenTableQR(t)}
                          className="p-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 transition-colors inline-flex items-center gap-1 text-[11px] font-bold"
                          title="Generate Table QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteTable(t.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Delete Table"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {vipTables.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-white/40">
                        No VIP tables configured yet. Click &ldquo;Add VIP Table&rdquo; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. STAFF WAITERS MANAGER TAB */}
      {activeTab === 'waiters' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiters.map((w) => {
              const assigned = vipTables.filter((t) => t.assigned_waiter_id === w.id);
              return (
                <div
                  key={w.id}
                  className="bg-[#141414] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FCF6BA] font-bold flex items-center justify-center">
                          {w.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#FCF6BA]">{w.name}</div>
                          <div className="text-[10px] text-white/50 flex items-center gap-1 font-mono">
                            PIN: {w.pin || '1234'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteWaiter(w.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete Waiter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 bg-[#1e1e1e] p-2.5 rounded-xl border border-white/5">
                      <div className="text-[10px] text-white/50 uppercase font-bold tracking-wider">
                        Assigned VIP Tables ({assigned.length}):
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assigned.map((t) => (
                          <span
                            key={t.id}
                            className="px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#FCF6BA] text-[10px] font-mono font-bold"
                          >
                            {t.table_number}
                          </span>
                        ))}
                        {assigned.length === 0 && (
                          <span className="text-[10px] text-white/40 italic">
                            No dedicated tables
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-white/60">Duty Status:</span>
                    <button
                      onClick={() => handleToggleWaiterDuty(w.id, w.is_on_duty)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        w.is_on_duty
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {w.is_on_duty ? '🟢 On Duty' : '⚪ On Break'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD VIP TABLE MODAL */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border-2 border-[#D4AF37]/50 rounded-2xl p-6 w-full max-w-md shadow-2xl text-[#EDEDED]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h3 className="font-extrabold text-base text-[#FCF6BA] flex items-center gap-2 font-display">
                <Crown className="w-5 h-5 text-[#D4AF37]" />
                Add New VIP Table
              </h3>
              <button
                onClick={() => setIsAddTableOpen(false)}
                className="p-1 rounded-lg text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  Table Number / Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP-5"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37] uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  Table Name / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Royal Fountain Suite"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  Assign Responsible Waiter (Direct Ring)
                </label>
                <select
                  value={newTableWaiterId}
                  onChange={(e) => setNewTableWaiterId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="">Unassigned (Alerts all on-duty waiters)</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  Optional Secret Access PIN (For extra exclusivity)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7775 (leave blank for open table access)"
                  value={newTableCode}
                  onChange={(e) => setNewTableCode(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-extrabold text-xs shadow"
                >
                  Save VIP Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD WAITER MODAL */}
      {isAddWaiterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border-2 border-[#D4AF37]/50 rounded-2xl p-6 w-full max-w-md shadow-2xl text-[#EDEDED]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h3 className="font-extrabold text-base text-[#FCF6BA] flex items-center gap-2 font-display">
                <UserPlus className="w-5 h-5 text-[#D4AF37]" />
                Add Staff Waiter
              </h3>
              <button
                onClick={() => setIsAddWaiterOpen(false)}
                className="p-1 rounded-lg text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWaiter} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  Waiter Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Tsegaye"
                  value={newWaiterName}
                  onChange={(e) => setNewWaiterName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  4-Digit Quick PIN (For Mobile Login)
                </label>
                <input
                  type="text"
                  placeholder="1234"
                  value={newWaiterPin}
                  onChange={(e) => setNewWaiterPin(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37] font-mono tracking-widest text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+251 91 ..."
                  value={newWaiterPhone}
                  onChange={(e) => setNewWaiterPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c0c] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddWaiterOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-extrabold text-xs shadow"
                >
                  Create Waiter Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INDIVIDUAL TABLE QR MODAL */}
      {selectedQRTable && qrModalDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border-2 border-[#D4AF37]/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center text-[#EDEDED]">
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedQRTable(null)}
                className="p-1 rounded-lg text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="inline-flex p-3 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] mb-2">
              <Crown className="w-6 h-6" />
            </div>

            <h3 className="font-extrabold text-lg text-[#FCF6BA] font-display">
              {selectedQRTable.table_number} QR Code
            </h3>
            <p className="text-xs text-[#D4AF37]/80 mb-4">{selectedQRTable.name}</p>

            <div className="bg-[#FBF5B7] p-4 rounded-2xl inline-block shadow-inner mb-4">
              <img
                src={qrModalDataUrl}
                alt={`QR code for ${selectedQRTable.table_number}`}
                className="w-48 h-48 mx-auto"
              />
            </div>

            <p className="text-[11px] text-white/60 mb-4 font-mono">
              {getVipTableUrl(selectedQRTable.table_number)}
            </p>

            <div className="flex gap-2">
              <a
                href={qrModalDataUrl}
                download={`${selectedQRTable.table_number}-qr-code.png`}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs shadow flex items-center justify-center gap-1.5 hover:brightness-110"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </a>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
