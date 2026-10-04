import React, { useState } from 'react';
import { Restaurant, Category, MenuItem, VipTable, Waiter, WaiterCall, CallType } from '../types/index.ts';
import { ItemCard } from './ItemCard.tsx';
import { callSound } from '../lib/callSound.ts';
import {
  Bell,
  BellRing,
  Crown,
  Sparkles,
  Utensils,
  Droplets,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Share2,
  ArrowLeft,
  Search,
  X,
} from 'lucide-react';

interface VipTableCustomerViewProps {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  table: VipTable;
  waiters: Waiter[];
  activeCalls: WaiterCall[];
  onPlaceCall: (tableId: string, callType: CallType, message?: string) => Promise<boolean>;
  onCancelCall: (callId: string) => Promise<void>;
  onChangeTable: () => void;
  onExitVip: () => void;
  onOpenQR: () => void;
}

export const VipTableCustomerView: React.FC<VipTableCustomerViewProps> = ({
  categories,
  items,
  table,
  waiters,
  activeCalls,
  onPlaceCall,
  onCancelCall,
  onChangeTable,
  onExitVip,
  onOpenQR,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [callSuccessFeedback, setCallSuccessFeedback] = useState<string | null>(null);

  // Find assigned responsible waiter
  const assignedWaiter = waiters.find((w) => w.id === table.assigned_waiter_id);

  // Find active call for this table
  const currentCall = activeCalls.find(
    (c) =>
      c.table_id === table.id &&
      (c.status === 'pending' || c.status === 'accepted')
  );

  // Sound unlock on first click
  const handleInteraction = () => {
    callSound.unlockAudio();
  };

  const handleCallWaiter = async (type: CallType = 'general') => {
    handleInteraction();
    setIsCalling(true);
    setCallSuccessFeedback(null);
    try {
      const ok = await onPlaceCall(table.id, type, customNote.trim() || undefined);
      if (ok) {
        callSound.playCustomerConfirmationChime();
        setCallSuccessFeedback(
          assignedWaiter
            ? `Calling ${assignedWaiter.name}'s phone...`
            : 'Alerting available floor waiters...'
        );
        setShowNoteInput(false);
        setCustomNote('');
      }
    } finally {
      setIsCalling(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div
      onClick={handleInteraction}
      className="min-h-screen bg-[#080808] text-[#EDEDED] flex flex-col font-sans pb-24"
    >
      {/* Top VIP Luxury Bar */}
      <header className="sticky top-0 z-40 bg-[#0c0c0c]/95 backdrop-blur-md border-b border-[#D4AF37]/30 shadow-xl px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onExitVip}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#D4AF37] transition-colors"
              title="Return to Standard Menu"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A]">
                <Crown className="w-4 h-4" />
              </span>
              <div>
                <h1 className="text-sm font-extrabold text-[#FCF6BA] font-display flex items-center gap-1.5">
                  Four Season VIP Lounge
                  <span className="text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 rounded-full font-mono">
                    {table.table_number}
                  </span>
                </h1>
                <p className="text-[11px] text-[#D4AF37]/80 font-medium truncate max-w-[200px] sm:max-w-xs">
                  {table.name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onChangeTable}
              className="px-2.5 py-1 text-xs rounded-lg bg-[#1a1a1a] hover:bg-[#242424] text-[#D4AF37] border border-[#D4AF37]/30 transition-all font-medium"
            >
              Switch Table
            </button>
            <button
              onClick={onOpenQR}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#FCF6BA] transition-colors"
              title="View Table QR Code"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main VIP Deck */}
      <main className="max-w-4xl mx-auto w-full px-4 pt-4 flex-1">
        {/* VIP Welcome & Waiter Assignment Card */}
        <div className="bg-gradient-to-br from-[#161616] via-[#111] to-[#1c180e] border-2 border-[#D4AF37]/40 rounded-2xl p-5 shadow-2xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FCF6BA] text-[11px] font-bold tracking-wider uppercase mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                Exclusive VIP Hospitality
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#FCF6BA] font-display">
                Welcome to {table.name}
              </h2>
              <p className="text-xs text-[#D4AF37]/80 mt-0.5">
                Press any service button below to immediately page staff.
              </p>
            </div>

            {/* Responsible Waiter Badge */}
            <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#D4AF37]/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] flex items-center justify-center font-bold text-sm shadow">
                {assignedWaiter ? assignedWaiter.name[0] : 'FS'}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                  Responsible Waiter
                </div>
                <div className="text-sm font-bold text-[#FCF6BA]">
                  {assignedWaiter ? assignedWaiter.name : 'All Floor Waiters (Broadcast)'}
                </div>
                <div className="text-[10px] flex items-center gap-1.5 mt-0.5">
                  {assignedWaiter ? (
                    assignedWaiter.is_on_duty ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        On Duty (Direct Ring)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        On Break (Routing to backup staff)
                      </span>
                    )
                  ) : (
                    <span className="text-blue-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Rings all on-duty waiters
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE CALL STATE BANNER */}
          {currentCall && (
            <div
              className={`mt-4 p-4 rounded-xl border transition-all ${
                currentCall.status === 'pending'
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/50'
                  : 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      currentCall.status === 'pending'
                        ? 'bg-amber-500 text-black animate-bounce'
                        : 'bg-emerald-500 text-black'
                    }`}
                  >
                    {currentCall.status === 'pending' ? (
                      <BellRing className="w-6 h-6 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded-md bg-black/40 text-[#FCF6BA]">
                        {currentCall.status === 'pending'
                          ? '🔔 Calling Staff...'
                          : '✅ Call Accepted!'}
                      </span>
                      <span className="text-xs text-white/70 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(currentCall.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white mt-1">
                      {currentCall.status === 'pending'
                        ? assignedWaiter
                          ? `Ringing ${assignedWaiter.name}'s phone for ${currentCall.call_type.toUpperCase()} request...`
                          : `Alerting floor waiters for ${currentCall.call_type.toUpperCase()} request...`
                        : `${currentCall.accepted_by_name || 'Waiter'} accepted and is heading to ${table.table_number}!`}
                    </p>
                    {currentCall.message && (
                      <p className="text-xs text-white/70 italic mt-0.5">
                        Note: &ldquo;{currentCall.message}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onCancelCall(currentCall.id)}
                    className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/80 hover:text-white text-xs border border-white/20 transition-all cursor-pointer"
                  >
                    Cancel Call
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SERVICE CALL BUTTONS DECK */}
          <div className="mt-5">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-[#D4AF37] mb-3 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
              Touch to Call Responsible Waiter:
            </h3>

            {/* Big Primary Call Button */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => handleCallWaiter('general')}
                disabled={isCalling}
                className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-gradient-to-b from-[#D4AF37] via-[#C89B2B] to-[#996515] text-[#0A0A0A] font-extrabold flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-[#FFF099]"
              >
                <BellRing className="w-6 h-6 animate-pulse" />
                <span className="text-xs text-center leading-tight">Call Waiter</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('order')}
                disabled={isCalling}
                className="p-3 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37]/60 text-[#FCF6BA] font-bold flex flex-col items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
              >
                <Utensils className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-xs text-center leading-tight">Take Order</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('water')}
                disabled={isCalling}
                className="p-3 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37]/60 text-[#FCF6BA] font-bold flex flex-col items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
              >
                <Droplets className="w-5 h-5 text-sky-400" />
                <span className="text-xs text-center leading-tight">Water Refill</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('bill')}
                disabled={isCalling}
                className="p-3 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37]/60 text-[#FCF6BA] font-bold flex flex-col items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
              >
                <Receipt className="w-5 h-5 text-amber-300" />
                <span className="text-xs text-center leading-tight">Request Bill</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('urgent')}
                disabled={isCalling}
                className="p-3 rounded-xl bg-[#291414] hover:bg-[#381a1a] border border-red-500/40 text-red-200 font-bold flex flex-col items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
              >
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-xs text-center leading-tight">Urgent Call</span>
              </button>
            </div>

            {/* Optional Custom Note Toggle */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 font-medium"
              >
                {showNoteInput ? '− Hide message note' : '+ Add custom note with call'}
              </button>
              {callSuccessFeedback && (
                <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                  {callSuccessFeedback}
                </span>
              )}
            </div>

            {showNoteInput && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g., Need extra ice, lemon, or baby chair..."
                  className="flex-1 px-3 py-2 bg-[#0c0c0c] border border-[#D4AF37]/40 rounded-lg text-xs text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="button"
                  onClick={() => handleCallWaiter('general')}
                  className="px-3 py-2 bg-[#D4AF37] text-black font-bold text-xs rounded-lg hover:brightness-110 cursor-pointer"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>

        {/* VIP Digital Menu Section */}
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-[#FCF6BA] font-display flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#D4AF37]" />
                Four Season VIP Digital Menu
              </h3>
              <p className="text-xs text-[#D4AF37]/80">
                Browse our specialty coffees, fresh mojitos, fast food, and signature dishes.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes & drinks..."
                className="w-full pl-9 pr-3 py-2 bg-[#141414] border border-[#D4AF37]/30 rounded-xl text-xs text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Tab Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-md shadow-[#D4AF37]/20'
                  : 'bg-[#181818] text-[#FCF6BA]/80 hover:bg-[#222] border border-white/5'
              }`}
            >
              All Items ({items.length})
            </button>
            {categories.map((cat) => {
              const count = items.filter((i) => i.category_id === cat.id).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-md shadow-[#D4AF37]/20'
                      : 'bg-[#181818] text-[#FCF6BA]/80 hover:bg-[#222] border border-white/5'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Dish Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onClick={() => handleCallWaiter('order')} />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="p-8 text-center bg-[#141414] rounded-2xl border border-white/10 mt-4 text-[#D4AF37]/70">
              No dishes found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Quick Call Bar for VIP Tables on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0e0e0e]/95 backdrop-blur-md border-t border-[#D4AF37]/40 px-4 py-2.5 shadow-2xl flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-[#FCF6BA] font-mono">{table.table_number}</span>
          <span className="text-[11px] text-[#D4AF37]/80 truncate max-w-[120px] sm:max-w-none">
            {assignedWaiter ? `Waiter: ${assignedWaiter.name}` : 'Staff Available'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCallWaiter('general')}
            disabled={isCalling}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] font-black text-xs shadow-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Call Waiter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
