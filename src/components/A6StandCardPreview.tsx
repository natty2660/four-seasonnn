import React from 'react';
import { VipTable } from '../types/index.ts';
import {
  Wifi,
  Camera,
  QrCode,
  Link2,
  Utensils,
  ChefHat,
  Coffee,
  Crown,
  Smartphone,
  Phone,
} from 'lucide-react';

interface A6StandCardPreviewProps {
  table: VipTable;
  theme: 'gold_luxury' | 'obsidian_dark';
  customBgUrl?: string | null;
  qrDataUrl: string;
}

export const A6StandCardPreview: React.FC<A6StandCardPreviewProps> = ({
  table,
  theme,
  customBgUrl,
  qrDataUrl,
}) => {
  const isDark = theme === 'obsidian_dark';

  return (
    <>
      {/* Print Stylesheet for exact 148mm x 105mm A6 Landscape physical printing */}
      <style>{`
        @media print {
          @page {
            size: 148mm 105mm landscape;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          body * {
            visibility: hidden !important;
          }
          #a6-stand-card-print-target,
          #a6-stand-card-print-target * {
            visibility: visible !important;
          }
          #a6-stand-card-print-target {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 148mm !important;
            height: 105mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Main A6 Horizontal (148mm x 105mm) Container with 148/105 aspect ratio */}
      <div
        id="a6-stand-card-print-target"
        className={`relative w-full aspect-[148/105] rounded-2xl sm:rounded-3xl border-2 sm:border-4 shadow-2xl overflow-hidden select-none flex flex-col justify-between p-3 sm:p-5 transition-all ${
          isDark
            ? 'bg-[#080808] text-white border-[#D4AF37]/80'
            : 'bg-[#FFFDF5] text-[#1C150E] border-[#B8861B]'
        }`}
        style={{
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 0 20px rgba(212, 175, 55, 0.15)'
            : '0 25px 50px -12px rgba(90, 60, 20, 0.25), inset 0 0 20px rgba(184, 134, 27, 0.1)',
        }}
      >
        {/* Custom Uploaded Background (if provided) */}
        {customBgUrl ? (
          <img
            src={customBgUrl}
            alt="Custom Background"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : (
          /* Procedural Marble Lighting & Veins */
          <>
            {isDark ? (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_25%,_rgba(235,195,90,0.14),_transparent_65%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_75%,_rgba(212,175,55,0.06),_transparent_55%)] pointer-events-none" />
                {/* Curved gold ribbon swoosh top-left */}
                <svg className="absolute -top-4 -left-4 w-40 sm:w-56 h-40 sm:h-56 pointer-events-none opacity-80" viewBox="0 0 100 100">
                  <path d="M 0 65 Q 40 45 65 0" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
                  <path d="M 0 70 Q 45 50 70 0" fill="none" stroke="rgba(255,240,160,0.6)" strokeWidth="0.8" />
                </svg>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-[#FFFDF5] via-[#FAF4E4] to-[#EFE3C3] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(212,175,55,0.12),_transparent_60%)] pointer-events-none" />
                {/* Curved gold ribbon swoosh top-left */}
                <svg className="absolute -top-4 -left-4 w-40 sm:w-56 h-40 sm:h-56 pointer-events-none opacity-80" viewBox="0 0 100 100">
                  <path d="M 0 65 Q 40 45 65 0" fill="none" stroke="#C99D2A" strokeWidth="2.8" />
                  <path d="M 0 70 Q 45 50 70 0" fill="none" stroke="#E8C860" strokeWidth="1" />
                </svg>
              </>
            )}
            {/* Subtle inner framing border */}
            <div
              className={`absolute inset-1.5 sm:inset-2 rounded-xl sm:rounded-2xl border pointer-events-none ${
                isDark ? 'border-[#D4AF37]/35' : 'border-[#B8861B]/35'
              }`}
            />
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TOP HEADER SECTION (Full Width) */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4 pb-1 sm:pb-2">
          {/* Left: Luxury Circular Seal Logo Emblem */}
          <div className="shrink-0 flex items-center pl-1 sm:pl-2">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#080808] border-2 sm:border-3 border-[#D4AF37] p-0.5 sm:p-1 flex items-center justify-center shadow-lg shadow-black/60 relative">
              <div className="w-full h-full rounded-full border border-[#D4AF37]/50 flex flex-col items-center justify-center p-0.5 text-center">
                <Crown className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#E8C860] mb-0.5" />
                <span className="text-[6px] sm:text-[8px] font-serif font-bold text-[#F5E6A3] tracking-widest uppercase leading-none">
                  FOUR SEASON
                </span>
                <span className="text-[10px] sm:text-[14px] font-serif font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FFF5B8] via-[#E5C158] to-[#9C7720] leading-none my-0.5 italic">
                  FS
                </span>
                <span className="text-[5px] sm:text-[7px] font-serif font-bold text-[#E8C860] tracking-wider leading-none">
                  Café &amp; Resto
                </span>
              </div>
            </div>
          </div>

          {/* Center Header Details */}
          <div className="flex-1 text-center min-w-0 pr-2 sm:pr-4">
            {/* Crown with Wing Rules */}
            <div className="flex items-center justify-center gap-2 mb-0.5">
              <div className="w-10 sm:w-20 h-px bg-gradient-to-r from-transparent to-[#D4AF37]" />
              <Crown className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#E8C860] drop-shadow" />
              <div className="w-10 sm:w-20 h-px bg-gradient-to-l from-transparent to-[#D4AF37]" />
            </div>

            {/* Main Title: FOUR SEASON (Metallic 3D Gradient) */}
            <h1 className="text-base sm:text-2xl md:text-3xl font-black font-serif tracking-wide sm:tracking-wider uppercase leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[#FFF4B8] via-[#E5C158] to-[#9C7720] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              FOUR SEASON
            </h1>

            {/* Subtitle: Café & Restaurant */}
            <p
              className={`text-[9px] sm:text-xs font-serif font-bold tracking-widest uppercase mt-0.5 ${
                isDark ? 'text-[#FFF0B3]' : 'text-[#3D2F1B]'
              }`}
            >
              — Café &amp; Restaurant —
            </p>

            {/* Tagline: Good Food • Great Mood */}
            <p className="text-[9px] sm:text-[11px] font-serif italic text-[#E8C860] mt-0.5">
              Good Food &bull; Great Mood
            </p>

            {/* Dynamic VIP Table Badge */}
            <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#0E0E0E] text-[#FCF6BA] border border-[#D4AF37] shadow-md">
              <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#D4AF37]" />
              <span className="text-[9px] sm:text-[11px] font-serif font-black tracking-wide">
                {table.table_number} &bull; {table.name}
              </span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MAIN BODY: TWO COLUMNS (Instructions Left & QR Code Right)     */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 grid grid-cols-12 gap-2 sm:gap-3 items-center flex-1 my-auto">
          {/* Left Column (col-span-7): Wi-Fi pill, 3 Steps, 3 Features */}
          <div className="col-span-7 flex flex-col justify-between h-full space-y-1.5 sm:space-y-2">
            {/* 1. Wi-Fi notice pill */}
            <div
              className={`flex items-center gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border shadow-sm ${
                isDark
                  ? 'bg-black/80 border-[#D4AF37]/70 text-white'
                  : 'bg-[#FFFDF5]/90 border-[#D4AF37] text-[#1C150E]'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E8C860] shrink-0" />
              <div className="w-px h-3.5 sm:h-4 bg-[#D4AF37]" />
              <span className="text-[8px] sm:text-[11px] font-sans font-bold truncate">
                Please make sure your phone is connected to the internet.
              </span>
            </div>

            {/* 2. HOW TO VIEW OUR MENU & 3 Steps */}
            <div className="flex flex-col items-center">
              {/* Header */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 w-full">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#D4AF37]" />
                <span
                  className={`text-[8px] sm:text-[11px] font-serif font-black uppercase tracking-wider ${
                    isDark ? 'text-[#FCF6BA]' : 'text-[#1C150E]'
                  }`}
                >
                  HOW TO VIEW OUR MENU
                </span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#D4AF37]" />
              </div>

              {/* 3 Steps Grid */}
              <div className="grid grid-cols-3 gap-1 sm:gap-2 w-full text-center">
                {/* Step 01 */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-0.5">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-[#FFF5B8] to-[#9C7720] text-[#080808] text-[7px] sm:text-[9px] font-black flex items-center justify-center border border-[#3A2A10] z-10 shadow">
                      01
                    </span>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-[#0A0A0A] border-1.5 sm:border-2 border-[#D4AF37] flex items-center justify-center text-[#E8C860] shadow">
                      <Camera className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  <span
                    className={`text-[7px] sm:text-[10px] font-serif font-bold leading-tight ${
                      isDark ? 'text-white' : 'text-[#1C150E]'
                    }`}
                  >
                    Open your camera
                  </span>
                </div>

                {/* Step 02 */}
                <div className="flex flex-col items-center border-x border-[#D4AF37]/40 px-0.5">
                  <div className="relative mb-0.5">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-[#FFF5B8] to-[#9C7720] text-[#080808] text-[7px] sm:text-[9px] font-black flex items-center justify-center border border-[#3A2A10] z-10 shadow">
                      02
                    </span>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-[#0A0A0A] border-1.5 sm:border-2 border-[#D4AF37] flex items-center justify-center text-[#E8C860] shadow">
                      <QrCode className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  <span
                    className={`text-[7px] sm:text-[10px] font-serif font-bold leading-tight ${
                      isDark ? 'text-white' : 'text-[#1C150E]'
                    }`}
                  >
                    Scan the QR code
                  </span>
                </div>

                {/* Step 03 */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-0.5">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-[#FFF5B8] to-[#9C7720] text-[#080808] text-[7px] sm:text-[9px] font-black flex items-center justify-center border border-[#3A2A10] z-10 shadow">
                      03
                    </span>
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-[#0A0A0A] border-1.5 sm:border-2 border-[#D4AF37] flex items-center justify-center text-[#E8C860] shadow">
                      <Link2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  <span
                    className={`text-[7px] sm:text-[10px] font-serif font-bold leading-tight ${
                      isDark ? 'text-white' : 'text-[#1C150E]'
                    }`}
                  >
                    Tap the link
                  </span>
                </div>
              </div>
            </div>

            {/* 3. 3-Feature Pill Bar */}
            <div className="flex items-center justify-around px-2 py-1 sm:py-1.5 rounded-full bg-[#080808] border border-[#D4AF37] shadow-md text-white">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#111] border border-[#D4AF37] flex items-center justify-center text-[#E8C860]">
                  <Utensils className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <div className="text-[7px] sm:text-[9px] font-serif font-bold text-[#F5E6A3] text-left leading-tight">
                  <div>Fresh</div>
                  <div>Ingredients</div>
                </div>
              </div>

              <div className="w-px h-5 sm:h-6 bg-[#D4AF37]/50" />

              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#111] border border-[#D4AF37] flex items-center justify-center text-[#E8C860]">
                  <ChefHat className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <div className="text-[7px] sm:text-[9px] font-serif font-bold text-[#F5E6A3] text-left leading-tight">
                  <div>Quality</div>
                  <div>Food</div>
                </div>
              </div>

              <div className="w-px h-5 sm:h-6 bg-[#D4AF37]/50" />

              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#111] border border-[#D4AF37] flex items-center justify-center text-[#E8C860]">
                  <Coffee className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <div className="text-[7px] sm:text-[9px] font-serif font-bold text-[#F5E6A3] text-left leading-tight">
                  <div>Great</div>
                  <div>Service</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (col-span-5): QR Code Container & CTA Pill */}
          <div className="col-span-5 flex flex-col items-center justify-center pl-1 sm:pl-2">
            {/* Solid Black QR Frame with Glowing Metallic Gold Border */}
            <div
              className="w-full max-w-[150px] sm:max-w-[210px] md:max-w-[240px] aspect-square rounded-2xl bg-[#0A0A0A] p-2 sm:p-3 border-2 sm:border-3 border-[#D4AF37] flex items-center justify-center shadow-xl relative"
              style={{
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.3)',
              }}
            >
              {/* Inner accent ring */}
              <div className="absolute inset-1 rounded-xl border border-[#D4AF37]/40 pointer-events-none" />
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR for ${table.table_number}`}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-[10px] text-[#FCF6BA]">Generating...</div>
              )}
            </div>

            {/* Bottom Scan CTA Pill */}
            <div className="mt-1.5 sm:mt-2.5 w-full max-w-[150px] sm:max-w-[210px] md:max-w-[240px] py-1 sm:py-1.5 px-2.5 rounded-full bg-[#080808] border border-[#D4AF37] flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg">
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E8C860] shrink-0 animate-pulse" />
              <div className="text-left font-serif leading-none">
                <div className="text-[7px] sm:text-[9px] font-black text-white">SCAN TO VIEW</div>
                <div className="text-[8px] sm:text-[10px] font-black text-[#E8C860]">OUR DIGITAL MENU</div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM FOOTER BAR (Full Width) */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 flex items-center justify-center gap-2 pt-1 sm:pt-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#D4AF37]" />
          <div
            className={`inline-flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-0.5 sm:py-1 rounded-full border text-[7px] sm:text-[10px] font-sans font-bold shadow-sm ${
              isDark
                ? 'bg-black/90 border-[#D4AF37]/70 text-white'
                : 'bg-[#FFFDF5]/95 border-[#D4AF37] text-[#2A2016]'
            }`}
          >
            {/* Z Agency Logo */}
            <span className="font-mono font-black text-[#D4AF37] text-[9px] sm:text-[11px]">⚡Z</span>
            <span>Powered by Zaza Digital Agency</span>
            <span className="text-[#D4AF37]">&bull;</span>
            <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#D4AF37]" />
            <span>Tell no: +251942850404</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#D4AF37]" />
        </div>
      </div>
    </>
  );
};
