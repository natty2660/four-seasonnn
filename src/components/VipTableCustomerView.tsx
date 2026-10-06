import React, { useState, useEffect } from 'react';
import { Restaurant, Category, MenuItem, VipTable, Waiter, WaiterCall, CallType } from '../types/index.ts';
import { ItemCard } from './ItemCard.tsx';
import { callSound } from '../lib/callSound.ts';
import {
  isVipSessionValid,
  getRemainingVipTime,
  formatRemainingTime,
  clearVipSession,
} from '../lib/vipSession.ts';
import { VipQrScannerModal } from './VipQrScannerModal.tsx';
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
  QrCode,
  Flame,
  Send,
  MessageSquarePlus,
  ShieldAlert,
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

  // VIP Expiration (4 Hours)
  const [remainingMs, setRemainingMs] = useState<number>(() => getRemainingVipTime(table.id));
  const [isExpired, setIsExpired] = useState<boolean>(() => !isVipSessionValid(table.id));
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Detail Modal for touched menu item (Fixes glitch where touching card called waiter)
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [orderSentFeedback, setOrderSentFeedback] = useState<string | null>(null);

  // Periodically re-evaluate 4-hour VIP session validity
  useEffect(() => {
    const checkExpiration = () => {
      const valid = isVipSessionValid(table.id);
      const ms = getRemainingVipTime(table.id);
      setRemainingMs(ms);
      if (!valid || ms <= 0) {
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    };

    checkExpiration();
    const timer = setInterval(checkExpiration, 1000);
    return () => clearInterval(timer);
  }, [table.id]);

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

  const handleCallWaiter = async (type: CallType = 'general', customMsg?: string) => {
    handleInteraction();

    // Check 4-hour expiration before placing call
    if (!isVipSessionValid(table.id)) {
      setIsExpired(true);
      return;
    }

    setIsCalling(true);
    setCallSuccessFeedback(null);
    try {
      const msgToSend = customMsg || customNote.trim() || undefined;
      const ok = await onPlaceCall(table.id, type, msgToSend);
      if (ok) {
        callSound.playCustomerConfirmationChime();
        setCallSuccessFeedback(
          assignedWaiter
            ? `Paging ${assignedWaiter.name}...`
            : 'Alerting floor staff...'
        );
        setShowNoteInput(false);
        setCustomNote('');
        setTimeout(() => setCallSuccessFeedback(null), 4000);
      }
    } finally {
      setIsCalling(false);
    }
  };

  const handleOrderDishFromModal = async (dish: MenuItem) => {
    handleInteraction();
    if (!isVipSessionValid(table.id)) {
      setIsExpired(true);
      setSelectedMenuItem(null);
      return;
    }

    setIsCalling(true);
    try {
      const ok = await onPlaceCall(table.id, 'order', `Order request: ${dish.name}`);
      if (ok) {
        callSound.playCustomerConfirmationChime();
        setOrderSentFeedback(`Order request for "${dish.name}" sent to waiter!`);
        setTimeout(() => {
          setOrderSentFeedback(null);
          setSelectedMenuItem(null);
        }, 1800);
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

  /* ------------------------------------------------------------- */
  /* SCREEN: 4-HOUR VIP SESSION EXPIRED                            */
  /* ------------------------------------------------------------- */
  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#EDEDED] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111111] border-2 border-red-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Expired Icon */}
          <div className="w-16 h-16 rounded-full bg-red-950/80 border-2 border-red-500/50 flex items-center justify-center mx-auto mb-4 text-red-400 shadow-lg">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-red-950/80 text-red-300 border border-red-500/40 text-[11px] font-bold uppercase tracking-wider mb-2">
            Session Expired (4 Hours)
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-[#FCF6BA] font-display mb-2">
            VIP Access Expired
          </h2>

          <p className="text-xs text-[#EDEDED]/80 leading-relaxed mb-4">
            For security and privacy, VIP table access automatically expires <strong className="text-amber-300">4 hours</strong> after scanning to prevent accidental waiter calling from outside the venue.
          </p>

          <div className="p-3 bg-[#181818] rounded-xl border border-white/10 mb-6 text-left">
            <div className="text-[11px] text-[#D4AF37] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Table: {table.table_number} ({table.name})
            </div>
            <p className="text-xs text-white/70">
              Please scan the QR stand located inside your VIP room again to restore full access.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] font-extrabold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan VIP QR Stand Again</span>
            </button>

            <button
              type="button"
              onClick={onExitVip}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-[#FCF6BA] text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
            >
              Browse Standard Menu
            </button>
          </div>
        </div>

        {/* QR Scanner / PIN Modal */}
        <VipQrScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          table={table}
          onSessionRenewed={() => {
            setIsExpired(false);
            setRemainingMs(getRemainingVipTime(table.id));
          }}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------- */
  /* SCREEN: ACTIVE VIP LOUNGE                                     */
  /* ------------------------------------------------------------- */
  return (
    <div
      onClick={handleInteraction}
      className="min-h-screen bg-[#080808] text-[#EDEDED] flex flex-col font-sans pb-20"
    >
      {/* Top VIP Luxury Bar */}
      <header className="sticky top-0 z-40 bg-[#0c0c0c]/95 backdrop-blur-md border-b border-[#D4AF37]/30 shadow-xl px-3 sm:px-4 py-2 sm:py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onExitVip}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#D4AF37] transition-colors shrink-0"
              title="Return to Standard Menu"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] shrink-0">
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-extrabold text-[#FCF6BA] font-display flex items-center gap-1.5 truncate">
                  Four Season VIP
                  <span className="text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-1.5 py-0.2 rounded-full font-mono">
                    {table.table_number}
                  </span>
                </h1>
                <p className="text-[10px] sm:text-[11px] text-[#D4AF37]/80 font-medium truncate">
                  {table.name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 4-Hour Expiration Chip */}
            <div
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                remainingMs < 30 * 60 * 1000
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                  : 'bg-black/60 text-[#FCF6BA]/90 border-[#D4AF37]/40'
              }`}
              title="4-Hour VIP Security Session remaining"
            >
              <Clock className="w-3 h-3 text-[#D4AF37]" />
              <span>{formatRemainingTime(remainingMs)}</span>
            </div>

            <button
              onClick={onChangeTable}
              className="px-2 py-1 text-[11px] rounded-lg bg-[#1a1a1a] hover:bg-[#242424] text-[#D4AF37] border border-[#D4AF37]/30 transition-all font-medium hidden sm:inline-block"
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
      <main className="max-w-4xl mx-auto w-full px-3 sm:px-4 pt-3 sm:pt-4 flex-1">
        {/* COMPACT LUXURY VIP STATUS & STREAMLINED SERVICE BAR */}
        <div className="bg-gradient-to-br from-[#161616] via-[#111] to-[#1a170f] border border-[#D4AF37]/35 rounded-2xl p-3 sm:p-4 shadow-xl mb-4 relative overflow-hidden">
          {/* Header Row: Room & Waiter (Ultra-Slim) */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded-md bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FCF6BA]">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              </span>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#FCF6BA] truncate block">
                  {table.name} · VIP Room
                </span>
                <span className="text-[10px] text-white/60">
                  {assignedWaiter ? `Dedicated Waiter: ${assignedWaiter.name}` : 'Floor Staff on Duty'}
                </span>
              </div>
            </div>

            {/* Waiter Status Badge */}
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400">Direct Staff Ring</span>
            </div>
          </div>

          {/* ACTIVE CALL STATE BANNER (Compact) */}
          {currentCall && (
            <div
              className={`mt-2.5 p-2.5 rounded-xl border transition-all ${
                currentCall.status === 'pending'
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-950/40'
                  : 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      currentCall.status === 'pending'
                        ? 'bg-amber-500 text-black animate-pulse'
                        : 'bg-emerald-500 text-black'
                    }`}
                  >
                    {currentCall.status === 'pending' ? (
                      <BellRing className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {currentCall.status === 'pending'
                        ? `Paging staff for ${currentCall.call_type}...`
                        : `${currentCall.accepted_by_name || 'Waiter'} accepted & is coming!`}
                    </p>
                    {currentCall.message && (
                      <p className="text-[10px] text-white/70 italic truncate">
                        &ldquo;{currentCall.message}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onCancelCall(currentCall.id)}
                  className="px-2 py-1 rounded-md bg-black/60 hover:bg-black/90 text-white/80 hover:text-white text-[10px] border border-white/20 transition-all shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STREAMLINED COMPACT CALL BUTTONS BAR (Significantly decreased footprint) */}
          <div className="mt-3">
            {/* Single Compact Quick-Action Strip */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Primary Call Staff Button (Compact Gold) */}
              <button
                type="button"
                onClick={() => handleCallWaiter('general')}
                disabled={isCalling}
                className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E8C860] to-[#C89B2B] text-[#0A0A0A] font-extrabold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-[#FFF099] flex items-center gap-1.5 shrink-0"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Call Staff</span>
              </button>

              {/* Compact Quick Request Pills */}
              <button
                type="button"
                onClick={() => handleCallWaiter('order')}
                disabled={isCalling}
                className="py-2 px-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37]/50 text-[#FCF6BA] text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Utensils className="w-3 h-3 text-[#D4AF37]" />
                <span>Order</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('water')}
                disabled={isCalling}
                className="py-2 px-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37]/50 text-[#FCF6BA] text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Droplets className="w-3 h-3 text-sky-400" />
                <span>Water</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('bill')}
                disabled={isCalling}
                className="py-2 px-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37]/50 text-[#FCF6BA] text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Receipt className="w-3 h-3 text-amber-300" />
                <span>Bill</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallWaiter('urgent')}
                disabled={isCalling}
                className="py-2 px-2.5 rounded-xl bg-[#241313] hover:bg-[#331818] border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>Urgent</span>
              </button>

              {/* Slim note toggle */}
              <button
                type="button"
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] text-xs border border-white/10 transition-colors ml-auto shrink-0"
                title="Add message note with call"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Note input drawer (compact) */}
            {showNoteInput && (
              <div className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Need extra ice, lemon, baby chair, etc..."
                  className="flex-1 px-3 py-1.5 bg-[#0c0c0c] border border-[#D4AF37]/40 rounded-lg text-xs text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="button"
                  onClick={() => handleCallWaiter('general')}
                  disabled={isCalling}
                  className="px-3 py-1.5 bg-[#D4AF37] text-black font-bold text-xs rounded-lg hover:brightness-110 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </div>
            )}

            {callSuccessFeedback && (
              <p className="text-[11px] text-emerald-400 font-medium mt-1.5 animate-fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{callSuccessFeedback}</span>
              </p>
            )}
          </div>
        </div>

        {/* VIP Digital Menu Section */}
        <div className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#FCF6BA] font-display flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#D4AF37]" />
                Four Season VIP Digital Menu
              </h3>
              <p className="text-[11px] text-[#D4AF37]/80">
                Touch any item to view its photo, ingredients, and description.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes & drinks..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#141414] border border-[#D4AF37]/30 rounded-xl text-xs text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Tab Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-sm'
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
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-sm'
                      : 'bg-[#181818] text-[#FCF6BA]/80 hover:bg-[#222] border border-white/5'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Dish Cards Grid - FIXED: TOUCHING CARD OPENS DETAIL MODAL (DOES NOT CALL WAITER ACCIDENTALLY) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => setSelectedMenuItem(item)}
              />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="p-8 text-center bg-[#141414] rounded-2xl border border-white/10 mt-4 text-[#D4AF37]/70 text-xs">
              No dishes found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* LUXURY ITEM DETAIL MODAL (Displays photo, description, notes)  */}
      {/* ------------------------------------------------------------- */}
      {selectedMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#111111] border-2 border-[#D4AF37]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#EDEDED]">
            {/* Close Button */}
            <button
              onClick={() => setSelectedMenuItem(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/70 text-white/80 hover:text-white hover:bg-black transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Photo Section */}
            <div className="relative w-full h-56 sm:h-64 bg-[#1a1a1a] overflow-hidden shrink-0">
              {selectedMenuItem.image_url ? (
                <img
                  src={selectedMenuItem.image_url}
                  alt={selectedMenuItem.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1c180e] to-[#0d0d0d] text-[#D4AF37]">
                  <Utensils className="w-12 h-12 mb-2 opacity-50" />
                  <span className="text-xs uppercase tracking-wider font-bold">
                    Four Season Specialty
                  </span>
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {selectedMenuItem.is_popular && (
                  <span className="px-2 py-0.5 rounded bg-black/80 text-[#FCF6BA] border border-[#D4AF37]/60 text-[10px] font-black uppercase">
                    ★ Signature
                  </span>
                )}
                {selectedMenuItem.is_spicy && (
                  <span className="px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-500/60 text-[10px] font-bold uppercase flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-amber-400" /> Seasoned
                  </span>
                )}
              </div>
            </div>

            {/* Content Section */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div>
                <h3 className="text-xl font-extrabold text-[#FCF6BA] font-display">
                  {selectedMenuItem.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Available in VIP Lounge
                  </span>
                  {selectedMenuItem.available_from && selectedMenuItem.available_until && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#D4AF37]" />
                        {selectedMenuItem.available_from} – {selectedMenuItem.available_until}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="pt-2 border-t border-white/10">
                <h4 className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-bold mb-1">
                  Description & Preparation:
                </h4>
                <p className="text-xs text-[#EDEDED]/90 leading-relaxed font-normal">
                  {selectedMenuItem.description || 'Prepared fresh with premium ingredients by our Four Season master chefs.'}
                </p>
              </div>

              {/* Transcription / Chef notes if present */}
              {selectedMenuItem.transcription_note && (
                <div className="p-3 bg-[#181818] rounded-xl border border-[#D4AF37]/30 text-xs text-[#FCF6BA]">
                  <span className="font-bold text-[#D4AF37] block text-[10px] uppercase mb-0.5">
                    Menu Board Note:
                  </span>
                  {selectedMenuItem.transcription_note}
                </div>
              )}

              {orderSentFeedback && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{orderSentFeedback}</span>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-white/10 bg-[#0e0e0e] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedMenuItem(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => handleOrderDishFromModal(selectedMenuItem)}
                disabled={isCalling}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] font-extrabold text-xs shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Call Waiter to Order This</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Quick Call Bar for VIP Tables on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c0c]/95 backdrop-blur-md border-t border-[#D4AF37]/40 px-3.5 py-2 shadow-2xl flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs font-bold text-[#FCF6BA] font-mono">{table.table_number}</span>
          <span className="text-[10px] text-[#D4AF37]/80 truncate">
            {assignedWaiter ? `Waiter: ${assignedWaiter.name}` : 'Staff Available'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleCallWaiter('general')}
          disabled={isCalling}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] font-black text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <BellRing className="w-3 h-3" />
          <span>Call Waiter</span>
        </button>
      </div>

      {/* QR Scanner / PIN Modal */}
      <VipQrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        table={table}
        onSessionRenewed={() => {
          setIsExpired(false);
          setRemainingMs(getRemainingVipTime(table.id));
        }}
      />
    </div>
  );
};
