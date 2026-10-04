package com.fourseason.waiter;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class IncomingCallActivity extends Activity {
    private static final String TAG = "IncomingCallActivity";

    private String callId = "";
    private String tableNumber = "VIP Table";
    private String customerName = "VIP Customer";
    private String notes = "Service requested";
    private String serverUrl = "https://ais-dev-f3z7xsgo4gzakdpxzf5ir5-912680925196.europe-west2.run.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn screen on and show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_incoming_call);

        // Parse extras
        Intent intent = getIntent();
        if (intent != null) {
            if (intent.hasExtra("call_id")) callId = intent.getStringExtra("call_id");
            if (intent.hasExtra("table_number")) tableNumber = intent.getStringExtra("table_number");
            if (intent.hasExtra("customer_name")) customerName = intent.getStringExtra("customer_name");
            if (intent.hasExtra("notes")) notes = intent.getStringExtra("notes");
            if (intent.hasExtra("server_url")) serverUrl = intent.getStringExtra("server_url");
        }

        TextView tvTable = findViewById(R.id.tv_table_number);
        TextView tvCustomer = findViewById(R.id.tv_customer_name);
        TextView tvNote = findViewById(R.id.tv_call_note);
        Button btnAccept = findViewById(R.id.btn_accept);
        Button btnDecline = findViewById(R.id.btn_decline);

        if (tvTable != null) tvTable.setText("TABLE " + tableNumber);
        if (tvCustomer != null) tvCustomer.setText(customerName != null ? customerName : "VIP Customer");
        if (tvNote != null) tvNote.setText(notes != null ? notes : "Service requested immediately");

        if (btnAccept != null) {
            btnAccept.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    handleAccept();
                }
            });
        }

        if (btnDecline != null) {
            btnDecline.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    handleDecline();
                }
            });
        }
    }

    private void handleAccept() {
        Log.d(TAG, "Accepting call: " + callId);
        // 1. Immediately stop ringing & vibration
        VipCallService.stopAlarmAudio(this);

        // 2. Report accepted to server
        sendCallActionToServer(callId, "accept");

        // 3. Launch MainActivity with call details
        try {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            mainIntent.putExtra("call_action", "accepted");
            mainIntent.putExtra("call_id", callId);
            mainIntent.putExtra("table_number", tableNumber);
            startActivity(mainIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error starting MainActivity: " + e.getMessage());
        }

        // 4. Close IncomingCallActivity
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    private void handleDecline() {
        Log.d(TAG, "Declining call: " + callId);
        // 1. Immediately stop ringing & vibration
        VipCallService.stopAlarmAudio(this);

        // 2. Report dismissed to server
        sendCallActionToServer(callId, "dismiss");

        // 3. Close IncomingCallActivity
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    private void sendCallActionToServer(final String id, final String action) {
        if (id == null || id.isEmpty()) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(serverUrl + "/api/waiter/calls/" + id + "/" + action);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    conn.setDoOutput(true);
                    OutputStream os = conn.getOutputStream();
                    os.write("{}".getBytes());
                    os.flush();
                    os.close();
                    int responseCode = conn.getResponseCode();
                    Log.d(TAG, "Call " + id + " " + action + " response: " + responseCode);
                    conn.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send call action: " + e.getMessage());
                }
            }
        }).start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Guaranteed stop of alarm sound & vibration if activity is destroyed
        VipCallService.stopAlarmAudio(this);
    }
}
