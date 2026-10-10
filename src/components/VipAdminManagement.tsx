import React, { useState, useEffect } from 'react';
import { VipTable, Waiter, WaiterCall } from '../types/index.ts';
import { generateQRCodeDataUrl, getVipTableUrl, downloadVipQRPNG } from '../lib/qr.ts';
import { apiFetch } from '../lib/apiConfig.ts';
import { BrandLogo } from './BrandLogo.tsx';
import {
  Crown,
  BellRing,
  UserCheck,
  UserPlus,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  QrCode,
  Download,
  Printer,
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Eye,
  ArrowLeft,
} from 'lucide-react';

interface VipAdminManagementProps {
  vipTables: VipTable[];
  waiters: Waiter[];
  calls: WaiterCall[];
  token: string;
  initialTab?: 'calls' | 'tables' | 'waiters' | 'qr_system';
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
  initialTab,
  onUpdateTables,
  onUpdateWaiters,
  onAcceptCall,
  onCompleteCall,
  onCancelCall,
}) => {
  const [activeTab, setActiveTab] = useState<'calls' | 'tables' | 'waiters' | 'qr_system'>(
    initialTab || 'calls'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Modal states
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isAddWaiterOpen, setIsAddWaiterOpen] = useState(false);
  const [selectedQRTable, setSelectedQRTable] = useState<VipTable | null>(null);
  const [qrModalDataUrl, setQrModalDataUrl] = useState<string>('');

  // VIP QR Studio states
  const [selectedStudioTableId, setSelectedStudioTableId] = useState<string>(
    vipTables[0]?.id || ''
  );
  const [directAccessMode, setDirectAccessMode] = useState<boolean>(true);
  const [embedPin, setEmbedPin] = useState<boolean>(true);
  const [qrTheme, setQrTheme] = useState<'gold_luxury' | 'obsidian_dark' | 'minimal_white'>(
    'gold_luxury'
  );
  const [studioQrDataUrl, setStudioQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [batchPrintMode, setBatchPrintMode] = useState<boolean>(false);
  const [batchQrMap, setBatchQrMap] = useState<Record<string, string>>({});

  // Ensure selectedStudioTableId is always valid
  useEffect(() => {
    if (vipTables.length > 0 && !vipTables.some((t) => t.id === selectedStudioTableId)) {
      setSelectedStudioTableId(vipTables[0].id);
    }
  }, [vipTables, selectedStudioTableId]);

  const currentStudioTable =
    vipTables.find((t) => t.id === selectedStudioTableId) || vipTables[0] || null;
  const currentStudioWaiter = waiters.find(
    (w) => w.id === currentStudioTable?.assigned_waiter_id
  );

  // Generate QR for Studio Preview
  useEffect(() => {
    if (!currentStudioTable) return;
    const url = getVipTableUrl(
      currentStudioTable.table_number,
      embedPin ? currentStudioTable.secret_code : null,
      directAccessMode
    );

    let darkColor = '#0A0A0A';
    let lightColor = '#FBF5B7';
    if (qrTheme === 'obsidian_dark') {
      darkColor = '#D4AF37';
      lightColor = '#0A0A0A';
    } else if (qrTheme === 'minimal_white') {
      darkColor = '#000000';
      lightColor = '#FFFFFF';
    }

    generateQRCodeDataUrl({
      url,
      size: 1024,
      darkColor,
      lightColor,
    })
      .then((dataUrl) => setStudioQrDataUrl(dataUrl))
      .catch((err) => console.error('Failed generating studio QR:', err));
  }, [currentStudioTable, directAccessMode, embedPin, qrTheme]);

  const handleCopyStudioLink = async () => {
    if (!currentStudioTable) return;
    const url = getVipTableUrl(
      currentStudioTable.table_number,
      embedPin ? currentStudioTable.secret_code : null,
      directAccessMode
    );
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleDownloadStudioPNG = async () => {
    if (!currentStudioTable) return;
    await downloadVipQRPNG(
      currentStudioTable.table_number,
      embedPin ? currentStudioTable.secret_code : null
    );
  };

  const handlePrepareBatchPrint = async () => {
    const map: Record<string, string> = {};
    for (const t of vipTables) {
      const url = getVipTableUrl(t.table_number, t.secret_code, true);
      try {
        const dUrl = await generateQRCodeDataUrl({
          url,
          size: 1024,
          darkColor: '#0A0A0A',
          lightColor: '#FBF5B7',
        });
        map[t.id] = dUrl;
      } catch (err) {
        console.error('Batch QR err:', err);
      }
    }
    setBatchQrMap(map);
    setBatchPrintMode(true);
  };

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
      const res = await apiFetch('/api/vip-tables', {
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
      const res = await apiFetch(`/api/vip-tables/${tableId}`, {
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
      const res = await apiFetch(`/api/vip-tables/${tableId}`, {
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
      const res = await apiFetch('/api/waiters', {
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
      const res = await apiFetch(`/api/waiters/${waiterId}`, {
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
    const remainingWaiters = waiters.filter((w) => w.id !== waiterId);
    // 1. Immediately update local state and sync via onUpdateWaiters
    onUpdateWaiters(remainingWaiters);
    // 2. Unassign from table local state and sync via onUpdateTables
    onUpdateTables(
      vipTables.map((t) =>
        t.assigned_waiter_id === waiterId ? { ...t, assigned_waiter_id: null } : t
      )
    );

    // 3. Authoritative DELETE request to backend
    try {
      await apiFetch(`/api/waiters/${waiterId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.warn('Waiter deletion network note:', err);
    }
  };

  const handleUpdateWaiterPin = async (waiterId: string, currentPin: string, waiterName: string) => {
    const input = prompt(`Enter new 4-digit security PIN for ${waiterName}:`, currentPin || '1234');
    if (!input || input.trim() === currentPin) return;
    const cleanPin = input.trim();
    try {
      const res = await apiFetch(`/api/waiters/${waiterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: cleanPin }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdateWaiters(waiters.map((w) => (w.id === waiterId ? { ...w, pin: cleanPin, ...updated } : w)));
        alert(`Security PIN for ${waiterName} successfully updated to ${cleanPin}.`);
      }
    } catch (err) {
      console.error('Failed to update waiter PIN:', err);
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
      await apiFetch('/api/waiter-calls/history', {
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'waiters'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-[#FCF6BA] hover:bg-[#222]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Staff Waiters ({waiters.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr_system')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'qr_system'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'bg-[#181818] text-[#FCF6BA] hover:bg-[#222]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>VIP QR Code System</span>
          </button>
        </div>

        {activeTab === 'qr_system' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrepareBatchPrint}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-1.5 shadow cursor-pointer hover:brightness-110 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Stands ({vipTables.length})</span>
            </button>
          </div>
        )}

        {activeTab === 'tables' && (
          <button
            onClick={() => setIsAddTableOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add VIP Table</span>
          </button>
        )}

        {activeTab === 'waiters' && (
          <button
            onClick={() => setIsAddWaiterOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Waiter</span>
          </button>
        )}

        {activeTab === 'calls' && pastCalls.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs border border-white/10 transition-colors cursor-pointer"
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
                        {/* Dropdown to change responsible waiter on the fly */}
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
                          className="p-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                          title="Generate Table QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteTable(t.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
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
          {/* Security & Lock Policy Notice */}
          <div className="bg-[#1C180E] border border-[#D4AF37]/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#FCF6BA] uppercase tracking-wider">
                  Waiter App Access Security Lock Active
                </h4>
                <p className="text-[11px] text-white/70 mt-0.5 leading-relaxed">
                  The Waiter App is securely locked against unauthorized public access. Staff must enter their 4-digit PIN to unlock their workspace. Master Manager Passcode: <span className="font-mono text-[#FCF6BA] font-bold">2026</span>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddWaiterOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs shadow hover:brightness-110 transition-all cursor-pointer shrink-0 self-start sm:self-center"
            >
              + Add New Waiter
            </button>
          </div>

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
                          <div className="text-[10px] text-white/50 flex items-center gap-1.5 font-mono">
                            <span>PIN:</span>
                            <span className="text-[#FCF6BA] font-bold">{w.pin || '1234'}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateWaiterPin(w.id, w.pin || '1234', w.name)}
                              className="text-[9px] text-[#D4AF37] hover:underline cursor-pointer ml-1"
                              title="Edit Staff PIN"
                            >
                              [Edit PIN]
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteWaiter(w.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
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
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
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

      {/* 4. VIP QR CODE GENERATION & ACCESS SYSTEM TAB */}
      {activeTab === 'qr_system' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#18160E] via-[#121212] to-[#1C180A] border-2 border-[#D4AF37]/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FCF6BA] text-xs font-bold uppercase tracking-wider mb-2">
                  <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Four Season VIP Table QR Access Engine
                </div>
                <h3 className="text-xl font-black text-[#FCF6BA] font-display">
                  VIP Table QR Code Generator &amp; Direct Access System
                </h3>
                <p className="text-xs text-[#D4AF37]/80 mt-1 max-w-2xl leading-relaxed">
                  Generate scannable QR codes for your physical table stands. When a VIP customer scans the code with their smartphone camera, they automatically gain VIP table access for 4 hours, view their dedicated waiter, and unlock one-tap waiter calling. Access securely expires after 4 hours to prevent off-premise paging.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handlePrepareBatchPrint}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-2 shadow-lg hover:brightness-110 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Batch Print All Tables ({vipTables.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Table Selector Cards */}
          <div className="bg-[#111] p-3.5 rounded-2xl border border-white/10">
            <label className="block text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider mb-2.5">
              Select VIP Table to Configure &amp; Generate:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {vipTables.map((t) => {
                const isSelected = t.id === selectedStudioTableId;
                const assignedWaiter = waiters.find((w) => w.id === t.assigned_waiter_id);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedStudioTableId(t.id)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#241F10] to-[#171408] border-[#D4AF37] shadow-lg shadow-[#D4AF37]/15 ring-1 ring-[#D4AF37]'
                        : 'bg-[#161616] border-white/10 hover:border-white/20 text-white/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-black text-sm text-[#FCF6BA]">
                        {t.table_number}
                      </span>
                      <Crown className={`w-3.5 h-3.5 ${isSelected ? 'text-[#D4AF37]' : 'text-white/30'}`} />
                    </div>
                    <div className="text-xs font-bold text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-white/50 mt-1 flex items-center justify-between">
                      <span>{assignedWaiter ? `Staff: ${assignedWaiter.name}` : 'Pool Waiter'}</span>
                      <span className="font-mono text-amber-300/80">PIN: {t.secret_code || 'None'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Two-Column Studio: Configuration & Live Stand Preview */}
          {currentStudioTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Generator Controls */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-[#141414] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
                  <h4 className="text-sm font-extrabold text-[#FCF6BA] flex items-center gap-2 border-b border-white/10 pb-3">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                    VIP Access &amp; QR Settings for {currentStudioTable.table_number}
                  </h4>

                  {/* Mode 1: Instant VIP Access Toggle */}
                  <div className="bg-[#1A1810] border border-[#D4AF37]/30 rounded-xl p-3.5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={directAccessMode}
                        onChange={(e) => setDirectAccessMode(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] accent-[#D4AF37]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#FCF6BA] flex items-center gap-1.5">
                          <span>Instant VIP Access Mode</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                            RECOMMENDED
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                          When checked, scanning the QR code immediately authenticates the customer and unlocks the VIP Lounge without requesting a PIN.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Mode 2: Embed Table PIN Toggle */}
                  <div className="bg-[#161616] border border-white/10 rounded-xl p-3.5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={embedPin}
                        onChange={(e) => setEmbedPin(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] accent-[#D4AF37]"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">Embed Verified PIN in QR Link</div>
                        <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                          Encodes the table access key ({currentStudioTable.secret_code || 'None'}) so guest devices are automatically recognized even on network drops.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Visual Style Theme */}
                  <div>
                    <label className="block text-xs font-bold text-white mb-2">QR Visual Color Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setQrTheme('gold_luxury')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          qrTheme === 'gold_luxury'
                            ? 'bg-[#FBF5B7] text-[#0A0A0A] border-[#D4AF37] ring-2 ring-[#D4AF37]'
                            : 'bg-[#181818] text-white/70 border-white/10'
                        }`}
                      >
                        <div className="w-5 h-5 rounded bg-[#0A0A0A] border border-[#D4AF37]" />
                        <span>Luxury Gold</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrTheme('obsidian_dark')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          qrTheme === 'obsidian_dark'
                            ? 'bg-[#0A0A0A] text-[#D4AF37] border-[#D4AF37] ring-2 ring-[#D4AF37]'
                            : 'bg-[#181818] text-white/70 border-white/10'
                        }`}
                      >
                        <div className="w-5 h-5 rounded bg-[#D4AF37]" />
                        <span>Obsidian Dark</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrTheme('minimal_white')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          qrTheme === 'minimal_white'
                            ? 'bg-white text-black border-white ring-2 ring-white'
                            : 'bg-[#181818] text-white/70 border-white/10'
                        }`}
                      >
                        <div className="w-5 h-5 rounded bg-white border border-gray-400" />
                        <span>Clean White</span>
                      </button>
                    </div>
                  </div>

                  {/* Direct VIP URL Display */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-white/60 mb-1">
                      Direct VIP Access URL (Encoded in QR)
                    </label>
                    <div className="flex items-center gap-2 bg-[#0c0c0c] border border-white/10 rounded-xl p-2 font-mono text-[11px] text-[#FCF6BA]">
                      <span className="truncate flex-1">
                        {getVipTableUrl(
                          currentStudioTable.table_number,
                          embedPin ? currentStudioTable.secret_code : null,
                          directAccessMode
                        )}
                      </span>
                      <button
                        onClick={handleCopyStudioLink}
                        className="px-2 py-1 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        title="Copy Link"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={handleDownloadStudioPNG}
                      className="py-2.5 px-3 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs shadow flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PNG (1200px)</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Stand Card</span>
                    </button>
                  </div>

                  {/* Test link */}
                  <div className="pt-1 text-center">
                    <a
                      href={getVipTableUrl(
                        currentStudioTable.table_number,
                        embedPin ? currentStudioTable.secret_code : null,
                        directAccessMode
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test Guest VIP Access In New Tab</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Table Stand Card (Printable) */}
              <div className="lg:col-span-6 flex flex-col items-center">
                <div className="w-full max-w-sm bg-gradient-to-b from-[#FAF4B7] via-[#F4E99B] to-[#E9D97E] border-4 border-[#080808] rounded-3xl p-6 sm:p-7 text-[#080808] shadow-2xl text-center relative overflow-hidden">
                  {/* Subtle inner gold border */}
                  <div className="absolute inset-2 rounded-2xl border border-dashed border-[#080808]/40 pointer-events-none" />

                  {/* Top Branding */}
                  <div className="flex flex-col items-center mb-3">
                    <BrandLogo size="md" showSubtitle={false} />
                    <h3 className="text-base font-black font-display tracking-wider uppercase mt-1 text-[#080808]">
                      Four Season VIP Lounge
                    </h3>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#080808] text-[#FCF6BA] text-[10px] font-extrabold uppercase tracking-widest mt-1 shadow">
                      <Crown className="w-3 h-3 text-[#D4AF37]" />
                      Exclusive Guest Table
                    </div>
                  </div>

                  {/* Table Identifier */}
                  <div className="my-2 py-1.5 border-y border-[#080808]/30">
                    <div className="text-2xl font-black font-mono tracking-tight text-[#080808]">
                      {currentStudioTable.table_number}
                    </div>
                    <div className="text-xs font-extrabold text-[#222]">
                      {currentStudioTable.name}
                    </div>
                  </div>

                  {/* High-Resolution Scannable QR Container */}
                  <div className="my-3 flex flex-col items-center justify-center">
                    <div className="p-3 bg-white rounded-2xl border-2 border-[#080808] shadow-inner inline-block">
                      {studioQrDataUrl ? (
                        <img
                          src={studioQrDataUrl}
                          alt={`QR for ${currentStudioTable.table_number}`}
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-xs">Generating QR...</div>
                      )}
                    </div>
                  </div>

                  {/* Scan Instructions */}
                  <div className="space-y-1">
                    <div className="bg-[#080808] text-[#FCF6BA] py-1 px-3 rounded-full text-xs font-black uppercase tracking-wider inline-block shadow">
                      Point Camera to Scan
                    </div>
                    <p className="text-[11px] font-bold text-[#111] leading-tight pt-1">
                      Direct VIP Access · Call Assigned Waiter · Full Menu
                    </p>
                    <div className="text-[10px] text-[#333] font-semibold pt-0.5">
                      {currentStudioWaiter
                        ? `Dedicated Waiter: ${currentStudioWaiter.name}`
                        : 'Dedicated Priority Waiter Service'}
                    </div>
                    {currentStudioTable.secret_code && (
                      <div className="text-[9px] font-mono text-[#555] pt-0.5">
                        Table PIN: {currentStudioTable.secret_code}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-white/50 text-center mt-3 max-w-xs">
                  This card represents the standard A6 acrylic stand size placed on VIP tables.
                </p>
              </div>
            </div>
          )}
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
                className="p-1 rounded-lg text-white/60 hover:text-white cursor-pointer"
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
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-extrabold text-xs shadow cursor-pointer"
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
                className="p-1 rounded-lg text-white/60 hover:text-white cursor-pointer"
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
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-extrabold text-xs shadow cursor-pointer"
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
                className="p-1 rounded-lg text-white/60 hover:text-white cursor-pointer"
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

            <p className="text-[11px] text-white/60 mb-4 font-mono break-all">
              {getVipTableUrl(selectedQRTable.table_number, selectedQRTable.secret_code, true)}
            </p>

            <div className="flex gap-2">
              <a
                href={qrModalDataUrl}
                download={`FourSeason-${selectedQRTable.table_number}-VIP-Access-QR.png`}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs shadow flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </a>
              <button
                onClick={() => {
                  setSelectedStudioTableId(selectedQRTable.id);
                  setSelectedQRTable(null);
                  setActiveTab('qr_system');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FCF6BA] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                title="Open in Full VIP QR Studio"
              >
                <QrCode className="w-4 h-4 text-[#D4AF37]" />
                <span className="hidden sm:inline">Studio</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                title="Print Stand Card"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH PRINT ALL STANDS OVERLAY */}
      {batchPrintMode && (
        <div className="fixed inset-0 z-50 bg-[#080808]/95 backdrop-blur-md overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
          <div className="w-full max-w-4xl flex items-center justify-between mb-6 print:hidden">
            <button
              onClick={() => setBatchPrintMode(false)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to VIP Studio</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black font-extrabold text-xs flex items-center gap-2 shadow-lg hover:brightness-110 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print All {vipTables.length} VIP Table Stands</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl pb-16">
            {vipTables.map((t) => {
              const dUrl = batchQrMap[t.id];
              const waiter = waiters.find((w) => w.id === t.assigned_waiter_id);
              return (
                <div
                  key={t.id}
                  className="bg-gradient-to-b from-[#FAF4B7] via-[#F4E99B] to-[#E9D97E] border-4 border-[#080808] rounded-3xl p-6 text-[#080808] shadow-2xl text-center relative overflow-hidden break-inside-avoid"
                  style={{ minHeight: '440px' }}
                >
                  <div className="flex flex-col items-center mb-2">
                    <BrandLogo size="md" showSubtitle={false} />
                    <h3 className="text-base font-black font-display tracking-wider uppercase mt-1">
                      Four Season VIP Lounge
                    </h3>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#080808] text-[#FCF6BA] text-[10px] font-black uppercase tracking-widest mt-0.5">
                      <Crown className="w-3 h-3 text-[#D4AF37]" />
                      Exclusive VIP Stand
                    </div>
                  </div>

                  <div className="my-2 py-1.5 border-y border-[#080808]/30">
                    <div className="text-2xl font-black font-mono tracking-tight">{t.table_number}</div>
                    <div className="text-xs font-bold text-[#222]">{t.name}</div>
                  </div>

                  <div className="my-3 flex justify-center">
                    <div className="p-3 bg-white rounded-2xl border-2 border-[#080808] shadow-inner inline-block">
                      {dUrl ? (
                        <img src={dUrl} alt={`QR for ${t.table_number}`} className="w-44 h-44 object-contain" />
                      ) : (
                        <div className="w-44 h-44 flex items-center justify-center text-xs">Generating QR...</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#080808] text-[#FCF6BA] py-1 px-3.5 rounded-full text-xs font-black uppercase tracking-wider inline-block mb-1 shadow">
                    Scan for Direct VIP Access
                  </div>
                  <p className="text-[11px] font-bold text-[#111] leading-tight">
                    Instant Table Call · Dedicated Waiter · Full Menu
                  </p>
                  <div className="text-[10px] font-semibold text-[#333] pt-0.5">
                    {waiter ? `Dedicated Waiter: ${waiter.name}` : 'Priority Table Service'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
