// Web Audio API Synthesizer and Vibration Controller for VIP Waiter Calls
// Provides rich restaurant chime sounds and mobile device vibration without any external audio files

class CallSoundController {
  private audioCtx: AudioContext | null = null;
  private ringInterval: number | null = null;
  private isRinging: boolean = false;
  private vibrationInterval: number | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Pre-unlock audio on user tap/interaction (required by iOS Safari and modern mobile browsers)
  public unlockAudio(): void {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      // Play a short silent buffer to satisfy browser autoplay policy
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.01);
    } catch {
      // Ignore
    }
  }

  // Play a single pleasant hotel bell chime
  public playSingleChime(freq1 = 880, freq2 = 1320): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Primary tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, now);
      osc1.frequency.exponentialRampToValueAtTime(freq1 * 0.98, now + 1.2);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Higher harmonic bell ring
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq2, now + 0.08);

      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 1.4);
    } catch {
      // Audio not permitted or supported
    }
  }

  // Confirmation sound for VIP Customer when button is touched
  public playCustomerConfirmationChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.36); // C6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);

      this.triggerVibration([80, 50, 80]);
    } catch {
      // Ignore
    }
  }

  // Start continuous loud restaurant waiter alert ring & vibration
  public startWaiterRingtone(): void {
    if (this.isRinging) return;
    this.isRinging = true;

    // First ring immediately
    this.playSingleChime(950, 1420);
    this.triggerVibration([400, 200, 400, 200, 600]);

    // Interval to repeat ring tone and vibration every 2.5 seconds
    this.ringInterval = window.setInterval(() => {
      if (!this.isRinging) return;
      this.playSingleChime(950, 1420);
    }, 2400);

    this.vibrationInterval = window.setInterval(() => {
      if (!this.isRinging) return;
      this.triggerVibration([400, 200, 400, 200, 600]);
    }, 2400);
  }

  // Stop ringtone and vibration immediately
  public stopWaiterRingtone(): void {
    this.isRinging = false;
    if (this.ringInterval !== null) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (this.vibrationInterval !== null) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    this.stopVibration();
  }

  public getIsRinging(): boolean {
    return this.isRinging;
  }

  // Mobile Device Vibration using Navigator.vibrate API
  public triggerVibration(pattern: number[] = [300, 150, 300]): void {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration errors on unsupported platforms
      }
    }
  }

  public stopVibration(): void {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }
}

export const callSound = new CallSoundController();
