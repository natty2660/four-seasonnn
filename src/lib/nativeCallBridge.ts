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
    if (this.isNative) {
      this.initNativeChannels();
    }
  }

  // Initialize Native Android & iOS Notification Channels & Permissions
  public async initNativeChannels(): Promise<void> {
    if (!this.isNative) return;

    try {
      // 1. Request local notification permissions
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') {
        // 2. Create High-Priority Notification Channel on Android for lock screen ringing
        await LocalNotifications.createChannel({
          id: 'vip_call_channel',
          name: 'VIP Table Urgent Calls',
          description: 'Phone-call style ringing, vibration, and locked-screen notification when VIP tables call',
          importance: 5, // MAX importance (makes heads-up banner and sound)
          visibility: 1, // VISIBILITY_PUBLIC (shows content on lockscreen)
          sound: 'restaurant_bell.wav',
          vibration: true,
          lights: true,
          lightColor: '#D4AF37',
        });
      }

      // 3. Setup Push Notifications (FCM / APNs)
      const pushPerm = await PushNotifications.requestPermissions();
      if (pushPerm.receive === 'granted') {
        await PushNotifications.register();
      }
    } catch (err: any) {
      console.warn('[NativeBridge] Channel init notice:', err.message);
    }
  }

  // Starts the Android Background Foreground Service so calls ring when app is closed / phone locked
  public async startBackgroundService(waiterId: string, waiterName: string): Promise<void> {
    if (!this.isNative) return;
    try {
      const serverUrl = getServerBaseUrl();
      await VipCallNative.startVipCallService({
        waiterId,
        waiterName,
        serverUrl,
      });
      console.log('✅ Started native Android background Foreground Service for:', waiterName);
    } catch (err: any) {
      console.warn('Native background service init info:', err.message);
    }
  }

  // Stops background service when waiter logs out or goes off duty
  public async stopBackgroundService(): Promise<void> {
    if (!this.isNative) return;
    try {
      await VipCallNative.stopVipCallService();
    } catch {}
  }

  // Register device push token with backend
  public registerPushToken(waiterId: string): void {
    if (!this.isNative) return;

    try {
      PushNotifications.addListener('registration', async (token) => {
        try {
          const baseUrl = getServerBaseUrl();
          await fetch(`${baseUrl}/api/waiter-push-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              waiter_id: waiterId,
              token: token.value,
              platform: Capacitor.getPlatform(),
            }),
          });
          console.log('✅ Registered native push token with server for waiter:', waiterId);
        } catch {}
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.warn('Native push registration error:', err);
      });
    } catch {}
  }

  // Start Real Native Phone Ringing & Repeating Haptic Vibration
  public async triggerNativeCallAlert(call: WaiterCall): Promise<void> {
    // 1. Call native Android plugin to wake lockscreen, play ALARM stream, and start continuous vibration
    if (this.isNative) {
      try {
        await VipCallNative.triggerCallAlert({
          callId: call.id,
          tableNumber: call.table_number,
          tableName: call.table_name || 'VIP Table',
          callType: call.call_type || 'general',
          isEscalated: Boolean(call.is_escalated),
        });
      } catch (err: any) {
        console.warn('Failed calling native VipCallNative.triggerCallAlert:', err.message);
      }
    }

    // 2. Start continuous repeating native haptic vibration fallback
    this.startContinuousHaptics();

    // 3. Fire high-priority lock-screen notification if on device
    if (this.isNative) {
      try {
        const notifId = Math.abs(parseInt(call.id.replace(/\D/g, '').slice(-6) || '999', 10));
        this.activeNotificationId = notifId;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: `👑 VIP CALL: ${call.table_number} (${call.table_name})`,
              body: `Incoming ${call.call_type.toUpperCase()} request! Tap to open and accept now.`,
              channelId: 'vip_call_channel',
              sound: 'restaurant_bell.wav',
              ongoing: true, // Cannot be swiped away until accepted!
              autoCancel: false,
              extra: {
                callId: call.id,
                tableNumber: call.table_number,
              },
            },
          ],
        });
      } catch (e: any) {
        console.warn('Failed scheduling local notification:', e.message);
      }
    }
  }

  // Stop All Native Ringing, Haptics, and Clear Ongoing Lockscreen Notification
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
        await VipCallNative.testAlarmRinging();
        setTimeout(() => {
          this.stopNativeCallAlert();
        }, 5000);
      } catch {}
    }
  }

  // Strong continuous haptic pulses for pocket alerts
  private startContinuousHaptics(): void {
    if (this.isVibrating) return;
    this.isVibrating = true;

    const vibrateOnce = async () => {
      try {
        if (this.isNative) {
          await Haptics.vibrate({ duration: 800 });
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([500, 200, 500, 200, 800]);
        }
      } catch {}
    };

    vibrateOnce();
    this.hapticsLoopId = window.setInterval(vibrateOnce, 2200);
  }

  private stopContinuousHaptics(): void {
    this.isVibrating = false;
    if (this.hapticsLoopId !== null) {
      clearInterval(this.hapticsLoopId);
      this.hapticsLoopId = null;
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  public getIsNative(): boolean {
    return this.isNative;
  }
}

export const nativeCallBridge = new NativeCallBridgeService();
