import React, { useState, useEffect } from 'react';
import { generateQRCodeDataUrl, getMenuUrl, downloadQRPNG } from '../lib/qr.ts';
import { BrandLogo } from './BrandLogo.tsx';
import { PrintableQRCard } from './PrintableQRCard.tsx';
import { X, Download, Copy, Check, ExternalLink, Printer } from 'lucide-react';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug?: string;
  cafeName?: string;
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  slug = 'prime-cafe',
  cafeName = 'Four Season Cafe and Restaurant',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [theme, setTheme] = useState<'buna_on_cream' | 'cream_on_buna' | 'classic'>('buna_on_cream');
  const [copied, setCopied] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [loading, setLoading] = useState(true);

  const menuUrl = getMenuUrl(slug);

  useEffect(() => {
    if (!isOpen) return;

    let darkColor = '#0A0A0A';
    let lightColor = '#FBF5B7';

    if (theme === 'cream_on_buna') {
      darkColor = '#D4AF37';
      lightColor = '#0A0A0A';
    } else if (theme === 'classic') {
      darkColor = '#000000';
      lightColor = '#FFFFFF';
    }

    setLoading(true);
    generateQRCodeDataUrl({
      url: menuUrl,
      size: 1024,
      darkColor,
      lightColor,
    })
      .then((url) => {
        setQrDataUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed generating QR code:', err);
        setLoading(false);
      });
  }, [isOpen, theme, menuUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Could not copy link:', e);
    }
  };

  const handleDownloadPNG = async () => {
    let darkColor = '#0A0A0A';
    let lightColor = '#FBF5B7';

    if (theme === 'cream_on_buna') {
      darkColor = '#D4AF37';
      lightColor = '#0A0A0A';
    } else if (theme === 'classic') {
      darkColor = '#000000';
      lightColor = '#FFFFFF';
    }

    await downloadQRPNG(slug, cafeName, darkColor, lightColor);
  };

  if (showPrintView) {
    return (
      <PrintableQRCard
        qrDataUrl={qrDataUrl}
        menuUrl={menuUrl}
        cafeName={cafeName}
        onBack={() => setShowPrintView(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gold-surface border-2 border-[#080808] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden text-[#080808]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#080808]/30 bg-[#E6C55A]">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" showSubtitle={false} />
            <div>
              <h2 className="text-base font-extrabold text-[#080808]">Table QR Code</h2>
              <p className="text-[11px] text-[#1A1A1A] font-semibold">Permanent Live Digital Menu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#080808] hover:bg-[#080808]/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* Permanent URL banner */}
          <div className="w-full bg-[#F7E6A2] border border-[#080808]/40 rounded-lg p-2.5 mb-5 text-left">
            <span className="text-[10px] text-[#1A1A1A] uppercase tracking-wider block font-bold">
              Permanent QR Destination
            </span>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs text-[#080808] font-bold font-mono truncate select-all">
                {menuUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="p-1.5 rounded bg-[#080808] text-[#FCF6BA] hover:bg-[#1A1A1A] transition-colors shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="relative p-4 rounded-xl bg-[#FBF5B7] border-4 border-[#080808] shadow-[0_6px_24px_rgba(0,0,0,0.25)] mb-4 flex items-center justify-center w-64 h-64">
            {loading ? (
              <div className="text-xs text-[#080808] font-semibold animate-pulse">
                Generating 1200px High-Res QR...
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${cafeName} QR Code`}
                className="w-full h-full object-contain"
              />
            ) : null}
          </div>

          {/* Theme Selector */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-[#080808] font-bold">Style:</span>
            <button
              onClick={() => setTheme('buna_on_cream')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                theme === 'buna_on_cream'
                  ? 'bg-[#080808] text-[#FCF6BA] font-bold border-[#080808]'
                  : 'bg-[#F7E6A2] text-[#080808] font-semibold border-[#080808]/35'
              }`}
            >
              Black on Gold
            </button>
            <button
              onClick={() => setTheme('cream_on_buna')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                theme === 'cream_on_buna'
                  ? 'bg-[#080808] text-[#FCF6BA] font-bold border-[#080808]'
                  : 'bg-[#F7E6A2] text-[#080808] font-semibold border-[#080808]/35'
              }`}
            >
              Gold on Black
            </button>
            <button
              onClick={() => setTheme('classic')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                theme === 'classic'
                  ? 'bg-[#080808] text-[#FCF6BA] font-bold border-[#080808]'
                  : 'bg-[#F7E6A2] text-[#080808] font-semibold border-[#080808]/35'
              }`}
            >
              High Contrast
            </button>
          </div>

          {/* Core Rule Guarantee */}
          <p className="text-xs text-[#111111] font-medium leading-relaxed mb-6 bg-[#F7E6A2] p-3 rounded-lg border border-[#080808]/35">
            <strong className="text-[#080808] font-extrabold">QR Never Changes:</strong> You can print this once for all tables at {cafeName}. When you update any dish in the Admin Dashboard, this SAME QR code displays the updated menu immediately.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            <button
              onClick={handleDownloadPNG}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#080808] text-[#FCF6BA] text-xs font-bold hover:bg-[#1A1A1A] shadow-md transition-all"
            >
              <Download className="w-4 h-4 text-[#D4AF37]" />
              Download PNG (1200px)
            </button>

            <button
              onClick={() => setShowPrintView(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F7E6A2] text-[#080808] hover:bg-[#FCF0BE] text-xs font-bold border border-[#080808]/50 transition-colors"
            >
              <Printer className="w-4 h-4 text-[#080808]" />
              Printable Stand Card
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-[#080808]/25 w-full flex items-center justify-between text-[11px] text-[#1A1A1A] font-semibold">
            <span>Error Correction: Level M</span>
            <a
              href={menuUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#080808] font-bold hover:underline"
            >
              Test Scan View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
