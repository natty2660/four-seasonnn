import React, { useState } from 'react';
import { VipTable } from '../types/index.ts';
import { Crown, Sparkles, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface VipTableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vipTables: VipTable[];
  onSelectTable: (table: VipTable) => void;
}

export const VipTableSelectorModal: React.FC<VipTableSelectorModalProps> = ({
  isOpen,
  onClose,
  vipTables,
  onSelectTable,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string>(vipTables[0]?.id || '');
  const [secretCodeInput, setSecretCodeInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSelected = vipTables.find((t) => t.id === selectedTableId) || vipTables[0];

  const handleConfirm = () => {
    setErrorMsg(null);
    if (!currentSelected) {
      setErrorMsg('Please select a VIP table.');
      return;
    }

    // If table has a secret code set, verify it
    if (currentSelected.secret_code && currentSelected.secret_code.trim()) {
      if (secretCodeInput.trim() !== currentSelected.secret_code.trim()) {
        setErrorMsg(`Incorrect VIP access PIN for ${currentSelected.table_number}. Please check your reservation or table card.`);
        return;
      }
    }

    onSelectTable(currentSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0e0e0e] border-2 border-[#D4AF37]/50 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 text-[#FCF6BA]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#D4AF37]/70 hover:text-[#FCF6BA] hover:bg-white/5 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] shadow-lg mb-3">
            <Crown className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#FCF6BA] font-display flex items-center justify-center gap-2">
            VIP Table Access
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          </h2>
          <p className="text-xs text-[#D4AF37]/80 mt-1 max-w-sm mx-auto">
            Exclusive private service for Four Season VIP guests with direct waiter calling & priority hospitality.
          </p>
        </div>

        {/* Table Selector */}
        <div className="space-y-4 mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
            Select Your VIP Table / Lounge:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {vipTables.map((t) => {
              const isSelected = t.id === selectedTableId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTableId(t.id);
                    setErrorMsg(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#D4AF37]/25 to-[#AA771C]/15 border-[#D4AF37] shadow-md ring-1 ring-[#D4AF37]'
                      : 'bg-[#181818] border-white/10 hover:border-[#D4AF37]/40 text-[#EDEDED]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-sm text-[#FCF6BA] font-mono">{t.table_number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                      VIP
                    </span>
                  </div>
                  <div className="text-xs text-[#FCF6BA]/90 font-medium truncate">{t.name}</div>
                  {t.secret_code && (
                    <div className="text-[10px] text-amber-300/70 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> PIN Protected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Secret Code Input (if protected) */}
          {currentSelected?.secret_code && (
            <div className="mt-3 bg-[#161616] p-3 rounded-xl border border-amber-500/30">
              <label className="block text-xs font-semibold text-amber-300 mb-1">
                Enter VIP Access PIN for {currentSelected.table_number}:
              </label>
              <input
                type="text"
                value={secretCodeInput}
                onChange={(e) => setSecretCodeInput(e.target.value)}
                placeholder="4-digit VIP Table PIN (e.g. 7771)"
                className="w-full px-3 py-2 bg-[#0c0c0c] border border-amber-500/40 rounded-lg text-sm text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37] text-center font-mono tracking-widest"
              />
              <p className="text-[10px] text-[#FCF6BA]/60 mt-1">
                Found on your VIP table card or reservation invite.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 text-xs text-center font-medium animate-shake">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] font-extrabold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Enter VIP Table Lounge</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-white/5 text-[#FCF6BA]/70 text-xs font-medium transition-colors"
          >
            Back to Standard Menu
          </button>
        </div>
      </div>
    </div>
  );
};
