import React from 'react';
import { X, Smartphone, CheckCircle2, Terminal } from 'lucide-react';

interface NativeAppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NativeAppInstallModal: React.FC<NativeAppInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#141414] border-2 border-[#D4AF37]/50 rounded-2xl shadow-2xl p-6 sm:p-8 text-[#EDEDED] max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] flex items-center justify-center font-bold shadow-lg">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#FCF6BA] font-display">
              Four Season Waiter Native App
            </h2>
            <p className="text-xs text-[#D4AF37]/80">
              Native Android APK • Lock-Screen Ringing • Persistent Background Service
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Native Hardware Features */}
          <div className="bg-[#1c1c1c] p-4 rounded-xl border border-[#D4AF37]/30 space-y-2">
            <h3 className="font-extrabold text-[#FCF6BA] text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Verified Native Android Architecture:
            </h3>
            <ul className="space-y-1.5 text-white/80 list-disc list-inside">
              <li>
                <strong>Lock-Screen Wake:</strong> Native <code className="text-amber-300">WAKE_LOCK</code> with <code className="text-amber-300">ACQUIRE_CAUSES_WAKEUP</code> turns the phone display on even inside pockets or face down.
              </li>
              <li>
                <strong>Full-Screen Incoming Call Activity:</strong> Dedicated <code className="text-amber-300">IncomingCallActivity</code> shows over the keyguard/lock screen like WhatsApp or Phone dialer without unlocking.
              </li>
              <li>
                <strong>Background / App Closed Persistence:</strong> Native <code className="text-amber-300">VipCallService</code> (Android Foreground Service with <code className="text-amber-300">START_STICKY</code>) stays alive even when the app is swiped away.
              </li>
              <li>
                <strong>Loud Alarm Audio Stream:</strong> Plays on <code className="text-amber-300">STREAM_ALARM</code> / <code className="text-amber-300">USAGE_ALARM</code>, ringing loudly even if the phone is set to silent or vibrate!
              </li>
              <li>
                <strong>Continuous Heavy Vibration:</strong> Repeating waveform pattern <code className="text-amber-300">&#123;0, 1000, 400, 1000, 400, 1500&#125;</code> loops indefinitely until accepted.
              </li>
              <li>
                <strong>45s Floor Auto-Escalation:</strong> If the designated waiter does not answer in 45s, server automatically escalates to all on-duty waiters.
              </li>
            </ul>
          </div>

          {/* Step-by-Step Build Instructions */}
          <div>
            <h4 className="font-bold text-[#D4AF37] mb-2 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              How to Build &amp; Install the Corrected APK:
            </h4>
            <div className="space-y-2.5 text-white/80">
              <div className="p-3 bg-black/50 rounded-xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-black text-xs flex items-center justify-center shrink-0">1</span>
                <div className="flex-1">
                  <strong>Sync Web Build to Android:</strong>
                  <div className="mt-1 p-2 bg-[#090909] rounded-lg font-mono text-[11px] text-amber-300 select-all">
                    npm run build &amp;&amp; npx cap sync android
                  </div>
                </div>
              </div>

              <div className="p-3 bg-black/50 rounded-xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-black text-xs flex items-center justify-center shrink-0">2</span>
                <div className="flex-1">
                  <strong>Compile Debug APK via Gradle:</strong>
                  <div className="mt-1 p-2 bg-[#090909] rounded-lg font-mono text-[11px] text-amber-300 select-all">
                    cd android &amp;&amp; ./gradlew assembleDebug
                  </div>
                  <span className="text-[10px] text-white/60 block mt-1">
                    Generated APK location: <code className="text-[#FCF6BA]">android/app/build/outputs/apk/debug/app-debug.apk</code>
                  </span>
                </div>
              </div>

              <div className="p-3 bg-black/50 rounded-xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-black text-xs flex items-center justify-center shrink-0">3</span>
                <div className="flex-1">
                  <strong>Install on Waiter&apos;s Phone:</strong>
                  <p className="mt-1 text-white/70">
                    Connect the phone via USB with USB Debugging enabled, or transfer the APK via WhatsApp, Drive, or local HTTP:
                  </p>
                  <div className="mt-1 p-2 bg-[#090909] rounded-lg font-mono text-[11px] text-amber-300 select-all">
                    adb install -r android/app/build/outputs/apk/debug/app-debug.apk
                  </div>
                </div>
              </div>

              <div className="p-3 bg-black/50 rounded-xl border border-white/10 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-black text-xs flex items-center justify-center shrink-0">4</span>
                <div className="flex-1">
                  <strong>Configure Server Connection in App:</strong>
                  <p className="mt-1 text-white/70">
                    Open the app on the phone, tap <strong>Server Connection (⚙)</strong>, enter your server IP (e.g. <code className="text-amber-300">http://192.168.1.50:3000</code>), select the waiter profile, and keep On-Duty enabled!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-extrabold text-xs shadow cursor-pointer"
            >
              Done / Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
