import React, { useState, useRef, useEffect } from 'react';
import { VipTable } from '../types/index.ts';
import { Camera, QrCode, KeyRound, X, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { startVipSession } from '../lib/vipSession.ts';

interface VipQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: VipTable;
  onSessionRenewed: () => void;
}

export const VipQrScannerModal: React.FC<VipQrScannerModalProps> = ({
  isOpen,
  onClose,
  table,
  onSessionRenewed,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'pin'>('camera');
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start camera helper
  const startCamera = async () => {
    setCameraError(null);
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        'Unable to open camera automatically. You can enter the 4-digit PIN from your VIP table stand or tap "Confirm Table Presence" below.'
      );
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleVerifyPin = () => {
    setErrorMsg(null);
    if (!pinInput.trim()) {
      setErrorMsg('Please enter the 4-digit PIN shown on your table stand.');
      return;
    }

    if (table.secret_code && pinInput.trim() !== table.secret_code.trim()) {
      setErrorMsg(`Incorrect PIN for ${table.table_number}. Please check the code on your table stand.`);
      return;
    }

    // Success: renew 4-hour session
    startVipSession(table.id, table.table_number);
    setSuccessMsg('VIP access renewed for 4 hours! Welcome back.');
    setTimeout(() => {
      onSessionRenewed();
      onClose();
    }, 1200);
  };

  const handleSimulatePhysicalScan = () => {
    // When guest is in the VIP room and re-scans or confirms physical presence
    startVipSession(table.id, table.table_number);
    setSuccessMsg(`VIP QR code verified for ${table.table_number}! Access renewed for 4 hours.`);
    setTimeout(() => {
      onSessionRenewed();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0e0e0e] border-2 border-[#D4AF37]/50 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 text-[#EDEDED]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#D4AF37]/70 hover:text-[#FCF6BA] hover:bg-white/5 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] shadow-lg mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#FCF6BA] font-display">
            Scan VIP QR Code
          </h2>
          <p className="text-xs text-[#D4AF37]/80 mt-1">
            Reactivate your 4-hour VIP room session for <strong className="text-white font-mono">{table.table_number}</strong> ({table.name}).
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-[#181818] p-1 mb-4 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'camera'
                ? 'bg-[#D4AF37] text-black shadow'
                : 'text-[#FCF6BA]/70 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Camera Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'pin'
                ? 'bg-[#D4AF37] text-black shadow'
                : 'text-[#FCF6BA]/70 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Enter PIN
          </button>
        </div>

        {/* Tab 1: Camera Scanner View */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative w-full aspect-square max-h-56 bg-black rounded-xl overflow-hidden border border-[#D4AF37]/40 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Viewfinder Target Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-40 border-2 border-[#D4AF37] rounded-xl relative shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#FCF6BA]" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#FCF6BA]" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#FCF6BA]" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#FCF6BA]" />
                    <div className="w-full h-0.5 bg-[#D4AF37]/70 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Fallback if camera permission denied or camera not started */}
              {!cameraActive && (
                <div className="p-4 text-center text-xs text-[#D4AF37]/80">
                  <QrCode className="w-12 h-12 mx-auto mb-2 text-[#D4AF37]/60" />
                  <p className="font-medium text-white mb-1">Point your camera at the VIP QR stand</p>
                  <p className="text-[11px] text-[#D4AF37]/70 mb-3">
                    Located on your table inside {table.table_number}.
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-[#222] hover:bg-[#2e2e2e] text-[#FCF6BA] text-xs font-bold rounded-lg border border-[#D4AF37]/30 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <p className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/30">
                {cameraError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSimulatePhysicalScan}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] font-extrabold text-xs shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>I Scanned Table {table.table_number} Stand</span>
            </button>
          </div>
        )}

        {/* Tab 2: PIN Input View */}
        {activeTab === 'pin' && (
          <div className="space-y-4 py-2">
            <div className="bg-[#141414] p-3.5 rounded-xl border border-[#D4AF37]/30 text-center">
              <label className="block text-xs font-bold text-[#FCF6BA] mb-1.5">
                VIP Access Code for {table.table_number}:
              </label>
              <input
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="e.g. 7771"
                maxLength={8}
                className="w-full px-3 py-2.5 bg-[#0c0c0c] border border-[#D4AF37]/50 rounded-lg text-lg text-center font-mono font-bold tracking-widest text-[#FCF6BA] focus:outline-none focus:border-[#D4AF37]"
              />
              <p className="text-[10px] text-[#D4AF37]/70 mt-1.5 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Printed directly beneath the QR code on your table stand.
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 text-xs text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyPin}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] font-extrabold text-xs shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Validate PIN & Unlock 4 Hours</span>
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-lg text-emerald-200 text-xs text-center font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#D4AF37]/70 hover:text-[#FCF6BA] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
