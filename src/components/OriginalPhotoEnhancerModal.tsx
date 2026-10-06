import React, { useState, useRef } from 'react';
import { MenuItem } from '../types/index.ts';
import {
  EnhancementOptions,
  enhanceOriginalDishPhoto,
  matchFilenameToMenuItems,
} from '../lib/imageEnhancer.ts';
import { apiFetch } from '../lib/apiConfig.ts';
import {
  X,
  Upload,
  Sparkles,
  Crop,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Image as ImageIcon,
} from 'lucide-react';

interface OriginalPhotoEnhancerModalProps {
  items: MenuItem[];
  onClose: () => void;
  onUpdateItems: (updatedItems: MenuItem[]) => void;
}

interface ProcessedPreview {
  fileName: string;
  itemName: string;
  itemId: string;
  imageUrl: string;
}

export const OriginalPhotoEnhancerModal: React.FC<OriginalPhotoEnhancerModalProps> = ({
  items,
  onClose,
  onUpdateItems,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [options, setOptions] = useState<EnhancementOptions>({
    cropMode: '4:3-studio',
    applyLightingAndClarity: true,
    applyWarmthAndVibrancy: true,
    applyVignette: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [processedList, setProcessedList] = useState<ProcessedPreview[]>([]);
  const [unmatchedFiles, setUnmatchedFiles] = useState<string[]>([]);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setProcessedList([]);
    setUnmatchedFiles([]);

    const updatedItems = [...items];
    const previews: ProcessedPreview[] = [];
    const unmatched: string[] = [];
    let matchedItemCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgressText(`Enhancing & installing ${i + 1} of ${files.length}: "${file.name}"...`);

      const matchedMenuItems = matchFilenameToMenuItems(file.name, updatedItems);
      if (matchedMenuItems.length === 0) {
        unmatched.push(file.name);
        continue;
      }

      for (let mIdx = 0; mIdx < matchedMenuItems.length; mIdx++) {
        const targetItem = matchedMenuItems[mIdx];
        try {
          // If 1 file maps to 2 items (e.g. "rice with tuna and rice tibs.jpg"), use a distinct framing crop for the 2nd item so images are never identical
          const itemEnhancementOptions: EnhancementOptions = {
            ...options,
            cropMode:
              mIdx > 0 && options.cropMode === '4:3-studio'
                ? '4:3-alt-angle'
                : options.cropMode,
          };

          const enhancedDataUrl = await enhanceOriginalDishPhoto(file, itemEnhancementOptions);

          let finalUrl = enhancedDataUrl;
          try {
            const res = await apiFetch('/api/upload-dish-photo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                itemId: targetItem.id,
                fileName: `${file.name.replace(/\.[^/.]+$/, '')}_${targetItem.id}.jpg`,
                dataBase64: enhancedDataUrl,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.image_url) {
                finalUrl = data.image_url;
              }
            }
          } catch {
            // Keep enhancedDataUrl fallback if offline
          }

          const idx = updatedItems.findIndex((it) => it.id === targetItem.id);
          if (idx !== -1) {
            updatedItems[idx] = {
              ...updatedItems[idx],
              image_url: finalUrl,
              updated_at: new Date().toISOString(),
            };
            matchedItemCount++;
            previews.push({
              fileName: file.name,
              itemName: updatedItems[idx].name,
              itemId: updatedItems[idx].id,
              imageUrl: finalUrl,
            });
          }
        } catch (err) {
          console.warn('Error enhancing photo:', file.name, err);
        }
      }
    }

    onUpdateItems(updatedItems);
    setProcessedList(previews);
    setUnmatchedFiles(unmatched);
    setIsProcessing(false);
    setProgressText(
      `Done! Enhanced & installed ${matchedItemCount} menu item photos from ${files.length} selected files with zero ingredient changes.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gold-surface border-2 border-[#080808] rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 text-[#080808]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-[#080808]/20">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#080808] text-[#D4AF37] mb-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 100% Original Ingredients Preserved
            </span>
            <h2 className="text-xl font-bold font-display text-[#080808]">
              Original Named Dish Photos Studio Enhancer
            </h2>
            <p className="text-xs text-[#1A1A1A] mt-0.5">
              Select all your named dish &amp; drink photos at once (e.g. <code>omelet.jpg</code>,{' '}
              <code>normal pasta.jpg</code>, <code>special firfir.jpg</code>, <code>Key wet.jpg</code>,{' '}
              <code>doro wet.jpg</code>, <code>kitfo.jpg</code>). Each photo is matched by filename and
              enhanced with studio crop, lighting &amp; clarity without changing any ingredients.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#080808] text-[#FCF6BA] hover:bg-[#1A1A1A] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Studio Quality & Crop Controls (Zero Ingredient Modification) */}
        <div className="bg-[#080808]/10 border border-[#080808]/25 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#080808] mb-3">
            <Sliders className="w-4 h-4" /> Studio Enhancement &amp; Framing Settings (No AI Hallucination)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FCF6BA]/70 border border-[#080808]/20 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={options.cropMode === '4:3-studio'}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    cropMode: e.target.checked ? '4:3-studio' : 'original',
                  }))
                }
                className="rounded accent-[#080808] w-4 h-4"
              />
              <span className="flex items-center gap-1.5">
                <Crop className="w-3.5 h-3.5" /> 4:3 Clean Plate Framing Crop
              </span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FCF6BA]/70 border border-[#080808]/20 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={options.applyLightingAndClarity}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, applyLightingAndClarity: e.target.checked }))
                }
                className="rounded accent-[#080808] w-4 h-4"
              />
              <span>HD Contrast &amp; Crisp Detail Clarity</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FCF6BA]/70 border border-[#080808]/20 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={options.applyWarmthAndVibrancy}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, applyWarmthAndVibrancy: e.target.checked }))
                }
                className="rounded accent-[#080808] w-4 h-4"
              />
              <span>Warm Studio Color &amp; Rich Vibrancy</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FCF6BA]/70 border border-[#080808]/20 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={options.applyVignette}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, applyVignette: e.target.checked }))
                }
                className="rounded accent-[#080808] w-4 h-4"
              />
              <span>Subtle Studio Edge Vignette Effect</span>
            </label>
          </div>
        </div>

        {/* Upload Dropzone Button */}
        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!isProcessing && e.dataTransfer.files?.length) {
              handleFilesSelected(e.dataTransfer.files);
            }
          }}
          className={`border-2 border-dashed border-[#080808] rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isProcessing
              ? 'bg-[#080808]/15 opacity-75 cursor-wait'
              : 'bg-[#FCF6BA]/60 hover:bg-[#FCF6BA] shadow-inner'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-[#080808] text-[#D4AF37] flex items-center justify-center mx-auto mb-3 shadow-md">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-[#080808]">
            {isProcessing
              ? 'Enhancing & Installing Your Original Dish Photos...'
              : 'Click Here or Drag & Drop All 75 Named Dish Photos at Once'}
          </p>
          <p className="text-xs text-[#1A1A1A] mt-1">
            Select all files in your folder (Ctrl+A / Cmd+A) — automatically matches every filename to its
            exact menu item and saves permanently.
          </p>
        </div>

        {progressText && (
          <div className="mt-4 p-3 rounded-xl bg-[#080808] text-[#FCF6BA] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>{progressText}</span>
          </div>
        )}

        {unmatchedFiles.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-900/20 border border-amber-900/40 text-xs text-[#080808]">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-4 h-4" /> Unmatched filenames ({unmatchedFiles.length}):
            </div>
            <p className="text-[11px]">{unmatchedFiles.join(', ')}</p>
          </div>
        )}

        {processedList.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#080808] mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Installed &amp; Enhanced Original Photos (
              {processedList.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
              {processedList.map((item) => (
                <div
                  key={`${item.itemId}-${item.fileName}`}
                  className="bg-[#080808] text-[#FCF6BA] rounded-xl overflow-hidden border border-[#080808]/30 shadow-sm"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.itemName}
                    className="w-full h-20 object-cover"
                  />
                  <div className="p-1.5">
                    <div className="text-[11px] font-bold truncate text-[#D4AF37]">
                      {item.itemName}
                    </div>
                    <div className="text-[9px] text-[#FCF6BA]/70 truncate">{item.fileName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#080808] text-[#FCF6BA] text-xs font-bold hover:bg-[#1A1A1A] transition-all"
          >
            Done &amp; View Menu
          </button>
        </div>
      </div>
    </div>
  );
};
