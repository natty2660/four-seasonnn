package com.fourseason.waiter;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VipCallNative")
public class VipCallNativePlugin extends Plugin {

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        String serverUrl = call.getString("serverUrl", "https://ais-dev-f3z7xsgo4gzakdpxzf5ir5-912680925196.europe-west2.run.app");
        Context context = getContext();

        Intent serviceIntent = new Intent(context, VipCallService.class);
        serviceIntent.setAction(VipCallService.ACTION_START_LISTENING);
        serviceIntent.putExtra("server_url", serverUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        JSObject ret = new JSObject();
        ret.put("status", "running");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, VipCallService.class);
        serviceIntent.setAction(VipCallService.ACTION_STOP_LISTENING);
        context.stopService(serviceIntent);

        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void testIncomingCall(PluginCall call) {
        Context context = getContext();
        String callId = call.getString("callId", "test-" + System.currentTimeMillis());
        String tableNumber = call.getString("tableNumber", "VIP-1");
        String customerName = call.getString("customerName", "VIP Customer");
        String notes = call.getString("notes", "Urgent test call");

        Intent alarmIntent = new Intent(context, VipCallService.class);
        alarmIntent.setAction(VipCallService.ACTION_TRIGGER_ALARM);
        alarmIntent.putExtra("call_id", callId);
        alarmIntent.putExtra("table_number", tableNumber);
        alarmIntent.putExtra("customer_name", customerName);
        alarmIntent.putExtra("notes", notes);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(alarmIntent);
        } else {
            context.startService(alarmIntent);
        }

        JSObject ret = new JSObject();
        ret.put("status", "triggered");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        Context context = getContext();
        VipCallService.stopAlarmAudio(context);

        Intent stopIntent = new Intent(context, VipCallService.class);
        stopIntent.setAction(VipCallService.ACTION_STOP_ALARM);
        context.startService(stopIntent);

        JSObject ret = new JSObject();
        ret.put("status", "silenced");
        call.resolve(ret);
    }
}
