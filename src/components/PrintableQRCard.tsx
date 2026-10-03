import React from 'react';
import { BrandLogo } from './BrandLogo.tsx';
import { ArrowLeft, Printer } from 'lucide-react';

interface PrintableQRCardProps {
  qrDataUrl: string;
  menuUrl: string;
  cafeName: string;
  onBack: () => void;
}

export const PrintableQRCard: React.FC<PrintableQRCardProps> = ({
  qrDataUrl,
  menuUrl,
  cafeName,
  onBack,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#D4AF37] bg-gold-canvas overflow-y-auto flex flex-col items-center p-4 sm:p-8">
      {/* Control Bar (hidden when printing) */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7E6A2] text-[#080808] hover:bg-[#FCF0BE] text-xs font-bold border border-[#080808]/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to QR Studio
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#080808] text-[#FCF6BA] text-xs font-bold hover:bg-[#1A1A1A] shadow-md transition-all"
        >
          <Printer className="w-4 h-4 text-[#D4AF37]" /> Print Table Stand (A6)
        </button>
      </div>

      {/* Printable A6 / Table Stand Card */}
      <div
        id="printable-card"
        className="relative w-full max-w-sm aspect-[1/1.414] bg-gold-surface border-4 border-[#080808] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center shadow-2xl text-[#080808] overflow-hidden"
        style={{
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 28px rgba(0,0,0,0.08)',
        }}
      >
        {/* Subtle Decorative Black Borders */}
        <div className="absolute inset-2 rounded-2xl border border-dashed border-[#080808]/45 pointer-events-none" />

        {/* Top: Cafe Identity */}
        <div className="flex flex-col items-center pt-2">
          <BrandLogo size="lg" showSubtitle={false} />
          <h1 className="text-xl sm:text-2xl font-black text-[#080808] font-display tracking-tight mt-2 uppercase">
            {cafeName}
          </h1>
          <p className="text-[11px] font-bold text-[#1A1A1A] tracking-widest uppercase mt-0.5">
            Specialty Coffee · Restaurant
          </p>
        </div>

        {/* Center: QR Code Container */}
        <div className="flex flex-col items-center my-3">
          <div className="bg-[#FBF5B7] p-3 rounded-2xl border-4 border-[#080808] shadow-xl w-52 h-52 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${cafeName} Menu QR Code`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-[#080808]">Loading QR...</div>
            )}
          </div>
          <span className="text-[10px] text-[#080808] font-bold font-mono mt-2 tracking-tight">
            {menuUrl}
          </span>
        </div>

        {/* Bottom: Instructions & Trust Markers */}
        <div className="flex flex-col items-center pb-2">
          <div className="bg-[#080808] px-4 py-1.5 rounded-full mb-2 shadow-md">
            <span className="text-xs font-extrabold text-[#FCF6BA] uppercase tracking-wide">
              Scan With Your Phone Camera
            </span>
          </div>

          <p className="text-[11px] text-[#111111] font-medium leading-tight max-w-[260px]">
            No app download or Wi-Fi login required. View our full live digital menu.
          </p>

          <div className="flex items-center gap-2.5 mt-3 text-[10px] text-[#080808] font-bold">
            <span>Breakfast</span>
            <span>·</span>
            <span>Lunch</span>
            <span>·</span>
            <span>Dinner</span>
            <span>·</span>
            <span>Drinks</span>
            <span>·</span>
            <span>Espresso</span>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background-color: transparent !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-card, #printable-card * {
            visibility: visible;
          }
          #printable-card {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            margin: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};
