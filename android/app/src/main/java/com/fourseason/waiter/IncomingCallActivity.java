package com.fourseason.waiter;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class IncomingCallActivity extends Activity {

    public static final String EXTRA_CALL_ID = "call_id";
    public static final String EXTRA_TABLE_NUMBER = "table_number";
    public static final String EXTRA_TABLE_NAME = "table_name";
    public static final String EXTRA_CALL_TYPE = "call_type";
    public static final String EXTRA_IS_ESCALATED = "is_escalated";

    private String callId = "";
    private String tableNumber = "";
    private String tableName = "";
    private String callType = "";
    private boolean isEscalated = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn on screen and show over lock screen
        setupLockScreenFlags();

        setContentView(R.layout.activity_incoming_call);

        parseIntentExtras(getIntent());
        setupUI();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        parseIntentExtras(intent);
        setupUI();
    }

    private void setupLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        }

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );
    }

    private void parseIntentExtras(Intent intent) {
        if (intent == null) return;
        callId = intent.getStringExtra(EXTRA_CALL_ID) != null ? intent.getStringExtra(EXTRA_CALL_ID) : "";
        tableNumber = intent.getStringExtra(EXTRA_TABLE_NUMBER) != null ? intent.getStringExtra(EXTRA_TABLE_NUMBER) : "VIP-1";
        tableName = intent.getStringExtra(EXTRA_TABLE_NAME) != null ? intent.getStringExtra(EXTRA_TABLE_NAME) : "VIP Table";
        callType = intent.getStringExtra(EXTRA_CALL_TYPE) != null ? intent.getStringExtra(EXTRA_CALL_TYPE) : "general";
        isEscalated = intent.getBooleanExtra(EXTRA_IS_ESCALATED, false);
    }

    private void setupUI() {
        TextView tvTableNumber = findViewById(R.id.tv_table_number);
        TextView tvTableName = findViewById(R.id.tv_table_name);
        TextView tvCallType = findViewById(R.id.tv_call_type);
        TextView tvEscalation = findViewById(R.id.tv_escalation_badge);
        Button btnAccept = findViewById(R.id.btn_accept_call);
        Button btnMute = findViewById(R.id.btn_mute_sound);

        if (tvTableNumber != null) tvTableNumber.setText(tableNumber);
        if (tvTableName != null) tvTableName.setText(tableName);

        if (tvCallType != null) {
            tvCallType.setText("REQUEST: " + callType.toUpperCase());
        }

        if (tvEscalation != null) {
            tvEscalation.setVisibility(isEscalated ? View.VISIBLE : View.GONE);
        }

        if (btnAccept != null) {
            btnAccept.setOnClickListener(v -> acceptCallAndOpenApp());
        }

        if (btnMute != null) {
            btnMute.setOnClickListener(v -> {
                VipCallService.muteSound(IncomingCallActivity.this);
                Toast.makeText(IncomingCallActivity.this, "Ringtone muted", Toast.LENGTH_SHORT).show();
            });
        }
    }

    private void acceptCallAndOpenApp() {
        // 1. Immediately stop native alarm sound and vibration
        VipCallService.stopCallAlert(this);

        // 2. Post accept call to backend API in background thread
        SharedPreferences prefs = getSharedPreferences("FourSeasonWaiterPrefs", Context.MODE_PRIVATE);
        String serverUrl = prefs.getString("server_url", "http://10.0.2.2:3000");
        String waiterId = prefs.getString("waiter_id", "");
        String waiterName = prefs.getString("waiter_name", "Waiter");

        if (serverUrl == null || serverUrl.isEmpty()) {
            serverUrl = "http://10.0.2.2:3000";
        }

        final String finalServerUrl = serverUrl;
        final String finalWaiterId = waiterId;
        final String finalWaiterName = waiterName;

        new Thread(() -> {
            try {
                if (!callId.isEmpty()) {
                    URL url = new URL(finalServerUrl + "/api/waiter-calls/" + callId + "/accept");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("PUT");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);

                    String payload = "{\"waiter_id\":\"" + finalWaiterId + "\",\"waiter_name\":\"" + finalWaiterName + "\"}";
                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = payload.getBytes(StandardCharsets.UTF_8);
                        os.write(input, 0, input.length);
                    }
                    conn.getResponseCode();
                    conn.disconnect();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();

        // 3. Open MainActivity so waiter sees the full VIP dashboard
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        mainIntent.putExtra("accepted_call_id", callId);
        startActivity(mainIntent);

        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }
}
