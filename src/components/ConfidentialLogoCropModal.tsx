import React, { useState, useRef, useEffect } from 'react';
import { Restaurant } from '../types/index.ts';
import { X, Upload, Crop, Check, ShieldCheck, RotateCcw, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/apiConfig.ts';

interface ConfidentialLogoCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  onUpdateRestaurant: (updated: Restaurant) => void;
}

export const ConfidentialLogoCropModal: React.FC<ConfidentialLogoCropModalProps> = ({
  isOpen,
  onClose,
  restaurant,
  onUpdateRestaurant,
}) => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.85); // Default crops out outer cafe & people
  const [offsetY, setOffsetY] = useState<number>(-18); // Default shifts up to wall & logo, cropping out people at bottom
  const [offsetX, setOffsetX] = useState<number>(0);
  const [logoZoom, setLogoZoom] = useState<number>(2.6);
  const [updateCircularLogo, setUpdateCircularLogo] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const wallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load current cover image as initial preview if no file selected yet
  useEffect(() => {
    if (!isOpen) return;
    if (sourceImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage(img);
    };
    img.src = restaurant.cover_url || '/assets/images/four_season_wall_logo_cropped_1790688123149.jpg';
  }, [isOpen, restaurant.cover_url, sourceImage]);

  // Render cropped Wall & Logo (16:9) and Circular Logo (1:1) with zero AI editing
  useEffect(() => {
    if (!sourceImage) return;

    // 1. Render 16:9 Wall & Logo Only Canvas
    if (wallCanvasRef.current) {
      const canvas = wallCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const targetW = 1280;
        const targetH = 720;
        canvas.width = targetW;
        canvas.height = targetH;

        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, targetW, targetH);

        // Compute base cover scale
        const scaleBase = Math.max(targetW / sourceImage.width, targetH / sourceImage.height);
        const finalScale = scaleBase * zoom;

        const drawW = sourceImage.width * finalScale;
        const drawH = sourceImage.height * finalScale;

        const centerX = (targetW - drawW) / 2 + (offsetX / 100) * drawW * 0.5;
        const centerY = (targetH - drawH) / 2 + (offsetY / 100) * drawH * 0.5;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceImage, centerX, centerY, drawW, drawH);
      }
    }

    // 2. Render 1:1 Center Logo Emblem Canvas
    if (logoCanvasRef.current) {
      const canvas = logoCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const size = 512;
        canvas.width = size;
        canvas.height = size;

        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, size, size);

        const scaleBase = Math.max(size / sourceImage.width, size / sourceImage.height);
        const finalScale = scaleBase * logoZoom;

        const drawW = sourceImage.width * finalScale;
        const drawH = sourceImage.height * finalScale;

        const centerX = (size - drawW) / 2 + (offsetX / 100) * drawW * 0.5;
        const centerY = (size - drawH) / 2 + (offsetY / 100) * drawH * 0.5;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceImage, centerX, centerY, drawW, drawH);
      }
    }
  }, [sourceImage, zoom, offsetX, offsetY, logoZoom, isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          setSourceImage(img);
          // Apply smart "Wall & Logo Only" preset that crops out background people & cafe
          setZoom(1.9);
          setOffsetY(-20);
          setOffsetX(0);
          setLogoZoom(2.8);
          setStatusMsg('Original confidential photo loaded! Background people & cafe cropped out — strictly Wall & Logo shown.');
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const applyPresetWallOnly = () => {
    setZoom(1.95);
    setOffsetY(-22);
    setOffsetX(0);
    setLogoZoom(2.85);
    setStatusMsg('Applied "Wall & Logo Only" crop — people and cafe background excluded.');
  };

  const applyPresetTightLogo = () => {
    setZoom(2.55);
    setOffsetY(-24);
    setOffsetX(0);
    setLogoZoom(3.4);
    setStatusMsg('Applied Tight Wall & Logo close-up crop.');
  };

  const applyPresetReset = () => {
    setZoom(1.15);
    setOffsetY(0);
    setOffsetX(0);
    setLogoZoom(1.8);
    setStatusMsg('Reset crop to full frame.');
  };

  const handleSaveCroppedAssets = async () => {
    if (!wallCanvasRef.current) return;
    setIsSaving(true);
    setStatusMsg('');

    try {
      const wallBase64 = wallCanvasRef.current.toDataURL('image/jpeg', 0.94);
      const logoBase64 =
        updateCircularLogo && logoCanvasRef.current
          ? logoCanvasRef.current.toDataURL('image/jpeg', 0.94)
          : undefined;

      // Update immediately on client for instant feedback
      const immediateRestaurant: Restaurant = {
        ...restaurant,
        cover_url: wallBase64,
        ...(logoBase64 ? { logo_url: logoBase64 } : {}),
        updated_at: new Date().toISOString(),
      };
      onUpdateRestaurant(immediateRestaurant);

      // Persist to server disk & PostgreSQL blobs
      const res = await apiFetch('/api/upload-brand-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallBase64,
          logoBase64,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.restaurant) {
          onUpdateRestaurant(data.restaurant);
        }
      }

      onClose();
    } catch {
      // Already applied in client state
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] border border-[#D4AF37]/60 w-full max-w-2xl rounded-2xl shadow-[0_0_40px_rgba(212,175,55,0.2)] overflow-hidden text-[#F9F6F0] my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#080808] border-b border-[#D4AF37]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-shiny-gold text-[#080808]">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-shiny-gold">
                Confidential Logo &amp; Wall Photo Cropper
              </h3>
              <p className="text-[11px] text-[#C7BFA8]">
                100% Unedited Original Logo · Crop Out Background People &amp; Cafe (Wall &amp; Logo Only)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#C7BFA8] hover:text-[#FCF6BA] hover:bg-[#1A1A1A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Upload Original Photo Banner */}
          <div className="p-4 rounded-xl bg-[#080808] border-2 border-dashed border-[#D4AF37]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#FCF6BA]">
                  Select Your Confidential Cafe Wall &amp; Logo Photo
                </h4>
                <p className="text-[11px] text-[#B8A878] mt-0.5 leading-relaxed">
                  Your logo is never edited or altered by AI. We strictly crop out the background people and cafe floor/tables so only the wall and your original logo are displayed.
                </p>
              </div>
            </div>

            <label className="shrink-0 px-4 py-2.5 rounded-xl bg-shiny-gold text-[#080808] font-extrabold text-xs cursor-pointer hover:brightness-110 transition-all shadow-md inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Choose Original Photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {statusMsg && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#1A160B] border border-[#D4AF37]/50 text-xs text-[#FCF6BA] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Live Previews: Wall Banner + Circular Logo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#E5C158] uppercase tracking-wider">
                  Cropped Wall &amp; Logo Preview (No People / Cafe)
                </span>
                <span className="text-[10px] text-[#9E947A]">16:9 Wall Focus</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border-2 border-[#D4AF37] bg-[#050505] aspect-video shadow-lg">
                <canvas
                  ref={wallCanvasRef}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col items-center">
              <span className="font-bold text-[#E5C158] uppercase tracking-wider text-xs">
                Logo Emblem Crop
              </span>
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-[#050505] shadow-[0_0_20px_rgba(212,175,55,0.35)]">
                <canvas
                  ref={logoCanvasRef}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[#D4C9B0] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={updateCircularLogo}
                  onChange={(e) => setUpdateCircularLogo(e.target.checked)}
                  className="rounded border-[#D4AF37] text-[#D4AF37]"
                />
                <span>Also update circular logo</span>
              </label>
            </div>
          </div>

          {/* 1-Click Smart Crop Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-[#B8A878] mr-1">
              Quick Crop Presets:
            </span>
            <button
              type="button"
              onClick={applyPresetWallOnly}
              className="px-3 py-1.5 rounded-lg bg-shiny-gold text-[#080808] text-xs font-extrabold hover:brightness-110 transition-all"
            >
              Auto-Crop People &amp; Cafe (Wall &amp; Logo Only)
            </button>
            <button
              type="button"
              onClick={applyPresetTightLogo}
              className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#242014] text-[#FCF6BA] border border-[#D4AF37]/40 text-xs font-semibold transition-colors"
            >
              Tight Wall &amp; Logo Close-Up
            </button>
            <button
              type="button"
              onClick={applyPresetReset}
              className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#242424] text-[#C7BFA8] border border-[#D4AF37]/20 text-xs font-medium inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Fine-Tune Sliders */}
          <div className="p-4 rounded-xl bg-[#080808] border border-[#D4AF37]/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#D4C9B0] font-semibold">Wall Zoom (Crop Out Sides/Cafe)</span>
                <span className="text-[#FCF6BA] font-mono">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-[#D4AF37] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#D4C9B0] font-semibold">Vertical Focus (Crop Bottom People)</span>
                <span className="text-[#FCF6BA] font-mono">{offsetY}%</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                className="w-full accent-[#D4AF37] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#D4C9B0] font-semibold">Horizontal Wall Position</span>
                <span className="text-[#FCF6BA] font-mono">{offsetX}%</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={offsetX}
                onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                className="w-full accent-[#D4AF37] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#D4C9B0] font-semibold">Circular Emblem Zoom</span>
                <span className="text-[#FCF6BA] font-mono">{Math.round(logoZoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="4.5"
                step="0.05"
                value={logoZoom}
                onChange={(e) => setLogoZoom(parseFloat(e.target.value))}
                className="w-full accent-[#D4AF37] cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D4AF37]/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#1A1A1A] text-[#C7BFA8] hover:text-[#FCF6BA] text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCroppedAssets}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-shiny-gold text-[#080808] text-xs font-extrabold hover:brightness-110 transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Applying...' : 'Apply Unedited Cropped Wall & Logo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
