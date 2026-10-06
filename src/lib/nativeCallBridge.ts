import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';
import { WaiterCall } from '../types/index.ts';
import { getServerBaseUrl } from './apiConfig.ts';

interface VipCallNativePluginInterface {
  startVipCallService(options: { waiterId: string; waiterName: string; serverUrl: string }): Promise<{ started: boolean }>;
  stopVipCallService(): Promise<{ stopped: boolean }>;
  triggerCallAlert(options: {
    callId: string;
    tableNumber: string;
    tableName: string;
    callType: string;
    isEscalated: boolean;
  }): Promise<{ triggered: boolean }>;
  stopCallAlert(): Promise<{ stopped: boolean }>;
  muteSound(): Promise<{ muted: boolean }>;
  testAlarmRinging(): Promise<{ testing: boolean }>;
}

const VipCallNative = registerPlugin<VipCallNativePluginInterface>('VipCallNative');

class NativeCallBridgeService {
  private isNative: boolean = false;
  private hapticsLoopId: number | null = null;
  private isVibrating: boolean = false;
  private activeNotificationId: number | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    // Phase 1: DO NOT automatically request notification permissions or trigger native service at startup
  }

  // Phase 1 Safe Channel Setup (No automatic startup permission requests)
  public async initNativeChannels(): Promise<void> {
    if (!this.isNative) return;
    // In Phase 1, we do not prompt for POST_NOTIFICATIONS during initialization
  }

  // Phase 1: Foreground service is disabled to prevent crashes on Android 13/14
  public async startBackgroundService(waiterId: string, waiterName: string): Promise<void> {
    if (!this.isNative) return;
    console.log('[Phase 1] Native background service start bypassed for:', waiterName, waiterId);
  }

  // Stops background service when waiter logs out or goes off duty
  public async stopBackgroundService(): Promise<void> {
    if (!this.isNative) return;
    try {
      await VipCallNative.stopVipCallService();
    } catch {}
  }

  // Register device push token with backend (Safe guard in Phase 1)
  public registerPushToken(waiterId: string): void {
    if (!this.isNative) return;
    // FCM push notifications will be fully wired in Phase 2
    console.log('[Phase 1] Push token registration deferred for waiter:', waiterId);
  }

  // Call Alert Trigger (In Phase 1, UI + in-app audio handled stably)
  public async triggerNativeCallAlert(call: WaiterCall): Promise<void> {
    // Phase 1: Keep app completely crash-free; avoid locked-screen alarm service
    console.log('[Phase 1] In-app call alert received for table:', call.table_number);
  }

  // Stop Call Alert
  public async stopNativeCallAlert(): Promise<void> {
    this.stopContinuousHaptics();

    if (this.isNative) {
      try {
        await VipCallNative.stopCallAlert();
      } catch {}
    }

    if (this.isNative && this.activeNotificationId !== null) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: this.activeNotificationId }],
        });
      } catch {}
      this.activeNotificationId = null;
    }
  }

  // Mute audio stream only
  public async muteNativeAlarm(): Promise<void> {
    if (this.isNative) {
      try {
        await VipCallNative.muteSound();
      } catch {}
    }
  }

  // Hardware audio & vibration test on device
  public async testDeviceHardware(): Promise<void> {
    if (this.isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (err: any) {
        console.warn('Haptics test note:', err.message);
      }
    }
  }

  // Repeating tactile vibration loop
  private startContinuousHaptics(): void {
    if (this.isVibrating || !this.isNative) return;
    this.isVibrating = true;

    const pulse = async () => {
      if (!this.isVibrating) return;
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {}
    };

    pulse();
    this.hapticsLoopId = window.setInterval(pulse, 1200);
  }

  // Stop tactile vibration loop
  private stopContinuousHaptics(): void {
    this.isVibrating = false;
    if (this.hapticsLoopId !== null) {
      clearInterval(this.hapticsLoopId);
      this.hapticsLoopId = null;
    }
  }
}

export const nativeCallBridge = new NativeCallBridgeService();
