package app.schulorga.lehrer;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Prüft auf neue App-Versionen, lädt sie herunter und startet die Installation. */
final class Updater {
    static final String PREFS = "updates";
    static final String APK_NAME = "Schulplan-update.apk";
    private static final String CHANNEL = "updates";

    interface Progress {
        void on(int percent);
    }

    private Updater() {
    }

    @SuppressWarnings("deprecation")
    static long installedVersionCode(Context c) {
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    static void setUrls(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("urls", json).apply();
    }

    static String[] urls(Context c) {
        try {
            JSONArray a = new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("urls", "[]"));
            String[] out = new String[a.length()];
            for (int i = 0; i < a.length(); i++) out[i] = a.getString(i);
            return out;
        } catch (Exception e) {
            return new String[0];
        }
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(12000);
        con.setReadTimeout(30000);
        con.setInstanceFollowRedirects(true);
        con.setRequestProperty("Cache-Control", "no-cache");
        con.setUseCaches(false);
        return con;
    }

    /** Liest die erste erreichbare version.json. */
    static JSONObject fetchInfo(String[] urls) throws Exception {
        Exception last = new Exception("Keine Update-Adresse");
        for (String u : urls) {
            if (u == null || !u.startsWith("https://")) continue;
            HttpURLConnection con = null;
            try {
                con = open(u + (u.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis());
                int code = con.getResponseCode();
                if (code != 200) {
                    last = new Exception("Server antwortet mit " + code);
                    continue;
                }
                try (InputStream in = con.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0 && out.size() < 512 * 1024) out.write(buf, 0, n);
                    JSONObject o = new JSONObject(out.toString("UTF-8"));
                    if (!o.has("versionCode") || !o.has("apk")) throw new Exception("Ungültige Versionsdatei");
                    o.put("source", u);
                    return o;
                }
            } catch (Exception e) {
                last = e;
            } finally {
                if (con != null) con.disconnect();
            }
        }
        throw last;
    }

    static File apkFile(Context c) {
        return new File(ShareProvider.shareDir(c), APK_NAME);
    }

    static void download(Context c, String url, Progress p) throws Exception {
        if (!url.startsWith("https://")) throw new Exception("Nur sichere Adressen (https) erlaubt");
        HttpURLConnection con = open(url);
        try {
            int code = con.getResponseCode();
            if (code != 200) throw new Exception("Download fehlgeschlagen (" + code + ")");
            long total = con.getContentLength();
            File tmp = new File(ShareProvider.shareDir(c), APK_NAME + ".part");
            try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[65536];
                long done = 0;
                int n, lastPct = -1;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    done += n;
                    if (total > 0) {
                        int pct = (int) (done * 100 / total);
                        if (pct != lastPct) {
                            lastPct = pct;
                            p.on(pct);
                        }
                    }
                }
            }
            File dst = apkFile(c);
            if (dst.exists()) dst.delete();
            if (!tmp.renameTo(dst)) throw new Exception("Datei konnte nicht gespeichert werden");
        } finally {
            con.disconnect();
        }
    }

    /** Startet die Installation. Gibt false zurück, wenn erst die Erlaubnis nötig ist. */
    static boolean install(Activity a) {
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()));
            a.startActivity(s);
            return false;
        }
        Uri uri = ShareProvider.uriFor(APK_NAME);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        a.startActivity(i);
        return true;
    }

    /** Tägliche Prüfung im Hintergrund einplanen. */
    static void scheduleDaily(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, UpdateReceiver.class).setAction("app.schulorga.lehrer.UPDATE_CHECK");
        PendingIntent pi = PendingIntent.getBroadcast(c, 424242, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + AlarmManager.INTERVAL_HOUR * 3,
                AlarmManager.INTERVAL_HALF_DAY, pi);
    }

    /** Hintergrundprüfung: Benachrichtigung bei neuer Version (nur einmal pro Version). */
    static void backgroundCheck(Context c) {
        try {
            String[] u = urls(c);
            if (u.length == 0) return;
            JSONObject info = fetchInfo(u);
            long code = info.optLong("versionCode");
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (code <= installedVersionCode(c) || p.getLong("notified", 0) >= code) return;
            p.edit().putLong("notified", code).apply();
            notifyNew(c, info.optString("versionName", ""), info.optJSONArray("notes"));
        } catch (Exception ignored) {
        }
    }

    static void notifyNew(Context c, String versionName, JSONArray notes) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "App-Updates", NotificationManager.IMPORTANCE_DEFAULT));
        }
        StringBuilder sb = new StringBuilder("Tippe, um jetzt zu aktualisieren.");
        if (notes != null) {
            for (int i = 0; i < Math.min(3, notes.length()); i++) sb.append("\n• ").append(notes.optString(i));
        }
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("route", "/update");
        PendingIntent pi = PendingIntent.getActivity(c, 424243, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Schulplan " + versionName + " ist da 🎉")
                .setContentText("Tippe, um jetzt zu aktualisieren.")
                .setStyle(new Notification.BigTextStyle().bigText(sb.toString()))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setColor(0xFF4F46E5);
        try {
            nm.notify(424243, b.build());
        } catch (SecurityException ignored) {
        }
    }
}
