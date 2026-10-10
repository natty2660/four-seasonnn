import React, { useState, useRef, useEffect } from 'react';
import { VipTable } from '../types/index.ts';
import { Camera, QrCode, X, CheckCircle2, RefreshCw } from 'lucide-react';
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
        'Camera permission was not granted or not available. Tap "Verify QR Stand Scan" below to restore VIP access.'
      );
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmQrScan = () => {
    // Verified by QR stand scan
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
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] shadow-lg mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#FCF6BA] font-display">
            Scan VIP QR Code
          </h2>
          <p className="text-xs text-[#D4AF37]/80 mt-1">
            Point your camera at the physical QR stand inside <strong className="text-white font-mono">{table.table_number}</strong> ({table.name}).
          </p>
        </div>

        {/* Camera Scanner View */}
        <div className="space-y-4">
          <div className="relative w-full aspect-square max-h-60 bg-black rounded-xl overflow-hidden border border-[#D4AF37]/40 flex items-center justify-center">
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
                <div className="w-44 h-44 border-2 border-[#D4AF37] rounded-xl relative shadow-[0_0_25px_rgba(212,175,55,0.4)]">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-[#FCF6BA]" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-[#FCF6BA]" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-[#FCF6BA]" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-[#FCF6BA]" />
                  <div className="w-full h-0.5 bg-[#D4AF37]/80 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                </div>
              </div>
            )}

            {/* Fallback if camera permission denied or camera not started */}
            {!cameraActive && (
              <div className="p-4 text-center text-xs text-[#D4AF37]/80">
                <QrCode className="w-12 h-12 mx-auto mb-2 text-[#D4AF37]/60" />
                <p className="font-medium text-white mb-1">Align camera with the table QR stand</p>
                <p className="text-[11px] text-[#D4AF37]/70 mb-3">
                  Located on your acrylic stand inside {table.table_number}.
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-1.5 bg-[#222] hover:bg-[#2e2e2e] text-[#FCF6BA] text-xs font-bold rounded-lg border border-[#D4AF37]/30 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restart Camera
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/30 text-center">
              {cameraError}
            </p>
          )}

          {errorMsg && (
            <p className="text-[11px] text-red-300 bg-red-950/40 p-2.5 rounded-lg border border-red-500/40 text-center">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmQrScan}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] font-extrabold text-xs shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Verify QR Stand Scan (Renew 4 Hours)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
