package app.schulorga.lehrer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Plant Erinnerungen (Prüfungen, Termine, Aufgaben, Stunden) über den AlarmManager. */
final class Reminders {
    private static final String PREFS = "reminders";
    private static final String KEY = "list";

    private Reminders() {
    }

    static synchronized void sync(Context c, String json) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(p.getString(KEY, "[]"));
            for (int i = 0; i < old.length(); i++) {
                cancel(c, old.getJSONObject(i).optInt("code"));
            }
        } catch (Exception ignored) {
        }
        JSONArray list;
        try {
            list = new JSONArray(json == null ? "[]" : json);
        } catch (Exception e) {
            list = new JSONArray();
        }
        p.edit().putString(KEY, list.toString()).apply();
        scheduleAll(c, list);
    }

    static synchronized void rescheduleAll(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            scheduleAll(c, new JSONArray(p.getString(KEY, "[]")));
        } catch (Exception ignored) {
        }
    }

    private static void scheduleAll(Context c, JSONArray list) {
        long now = System.currentTimeMillis();
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject r = list.getJSONObject(i);
                long t = r.getLong("time");
                if (t > now) schedule(c, r);
            } catch (Exception ignored) {
            }
        }
    }

    private static PendingIntent intentFor(Context c, int code, JSONObject r, boolean create) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction("app.schulorga.lehrer.REMINDER." + code);
        if (r != null) {
            i.putExtra("code", code);
            i.putExtra("title", r.optString("title", "SchulOrga"));
            i.putExtra("text", r.optString("text", ""));
            i.putExtra("route", r.optString("route", ""));
        }
        int flags = PendingIntent.FLAG_IMMUTABLE | (create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(c, code, i, flags);
    }

    private static void schedule(Context c, JSONObject r) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int code = r.optInt("code");
        long t = r.optLong("time");
        PendingIntent pi = intentFor(c, code, r, true);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
        }
    }

    private static void cancel(Context c, int code) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = intentFor(c, code, null, false);
        if (am != null && pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }
}
