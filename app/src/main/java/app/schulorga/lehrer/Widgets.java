package app.schulorga.lehrer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Startbildschirm-Widgets. Die App legt bei jeder Änderung eine kleine Vorschau-Datei
 * (JSON) für die nächsten Tage ab, die Widgets lesen nur diese.
 */
final class Widgets {
    private static final String PREFS = "widgets";
    private static final String[] WD = {"So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"};
    private static final String[] WD_LONG = {"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"};

    static final int TODAY = 0, NEXT = 1, TASKS = 2, AGENDA = 3;

    private Widgets() {
    }

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply();
        updateAll(c);
    }

    private static JSONObject data(Context c) {
        try {
            return new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (m == null) return;
        Class<?>[] types = {WidgetToday.class, WidgetNext.class, WidgetTasks.class, WidgetAgenda.class};
        for (int t = 0; t < types.length; t++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, types[t]));
            if (ids != null && ids.length > 0) update(c, m, ids, t);
        }
    }

    static void update(Context c, AppWidgetManager m, int[] ids, int type) {
        JSONObject d = data(c);
        for (int id : ids) {
            try {
                RemoteViews v = type == NEXT ? buildNext(c, d) : buildList(c, m, id, type, d);
                m.updateAppWidget(id, v);
            } catch (Exception ignored) {
            }
        }
    }

    // ------------------------------------------------------------------ Hilfen

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(new Date());
    }

    private static Calendar cal(String iso) {
        Calendar c = Calendar.getInstance();
        try {
            c.setTime(new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).parse(iso));
        } catch (Exception ignored) {
        }
        return c;
    }

    private static String addDays(String iso, int n) {
        Calendar c = cal(iso);
        c.add(Calendar.DAY_OF_MONTH, n);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(c.getTime());
    }

    private static int daysBetween(String a, String b) {
        long ms = cal(b).getTimeInMillis() - cal(a).getTimeInMillis();
        return (int) Math.round(ms / 86400000.0);
    }

    private static String shortDate(String iso) {
        Calendar c = cal(iso);
        return String.format(Locale.GERMANY, "%02d.%02d.", c.get(Calendar.DAY_OF_MONTH), c.get(Calendar.MONTH) + 1);
    }

    private static String weekday(String iso) {
        return WD[cal(iso).get(Calendar.DAY_OF_WEEK) - 1];
    }

    private static String rel(String iso, String td) {
        int n = daysBetween(td, iso);
        if (n == 0) return "Heute";
        if (n == 1) return "Morgen";
        if (n == -1) return "Gestern";
        if (n < 0) return "Überfällig";
        if (n < 7) return WD_LONG[cal(iso).get(Calendar.DAY_OF_WEEK) - 1];
        return shortDate(iso);
    }

    private static int minutes(String hhmm) {
        try {
            String[] p = hhmm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) {
            return -1;
        }
    }

    private static int nowMin() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    private static int color(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static PendingIntent open(Context c, String route, int code) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra("route", route);
        return PendingIntent.getActivity(c, 7000 + code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static int rowsFor(AppWidgetManager m, int id) {
        Bundle o = m.getAppWidgetOptions(id);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (h <= 0) return 3;
        return Math.max(1, Math.min(8, (h - 54) / 42));
    }

    private static RemoteViews row(Context c, String time, String title, String sub, int barColor, boolean dim) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_row);
        r.setTextViewText(R.id.r_time, time);
        r.setTextViewText(R.id.r_title, title);
        r.setTextViewText(R.id.r_sub, sub);
        r.setViewVisibility(R.id.r_sub, sub == null || sub.isEmpty() ? View.GONE : View.VISIBLE);
        r.setInt(R.id.r_bar, "setColorFilter", barColor);
        if (dim) {
            int muted = c.getResources().getColor(R.color.w_sub, null);
            r.setTextColor(R.id.r_title, muted);
        }
        return r;
    }

    /** Ersten Tag (ab heute) mit Unterricht finden. */
    private static String nextSchoolDay(JSONObject days, String td, boolean skipTodayIfOver) {
        for (int i = 0; i < 8; i++) {
            String d = addDays(td, i);
            JSONArray a = days.optJSONArray(d);
            if (a == null || a.length() == 0) continue;
            if (i == 0 && skipTodayIfOver) {
                JSONObject last = a.optJSONObject(a.length() - 1);
                if (last != null && minutes(last.optString("e")) <= nowMin()) continue;
            }
            return d;
        }
        return null;
    }

    // ------------------------------------------------------------------ Listen-Widgets

    private static RemoteViews buildList(Context c, AppWidgetManager m, int id, int type, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_list);
        v.removeAllViews(R.id.w_rows);
        int max = rowsFor(m, id);
        String td = today();
        int accent = c.getResources().getColor(R.color.w_accent, null);
        int added = 0;
        String empty = null;

        if (!d.has("days")) {
            v.setTextViewText(R.id.w_title, type == TASKS ? "Aufgaben" : type == AGENDA ? "Termine" : "Stundenplan");
            v.setTextViewText(R.id.w_badge, "");
            v.setViewVisibility(R.id.w_badge, View.GONE);
            empty = "Öffne Schulplan einmal, damit das Widget Daten bekommt.";
        } else if (type == TODAY) {
            JSONObject days = d.optJSONObject("days");
            String day = days == null ? null : nextSchoolDay(days, td, true);
            v.setImageViewResource(R.id.w_icon, R.drawable.w_ic_today);
            if (day == null) {
                v.setTextViewText(R.id.w_title, "Stundenplan");
                v.setViewVisibility(R.id.w_badge, View.GONE);
                empty = "Keine Stunden in den nächsten Tagen 🎉";
            } else {
                v.setTextViewText(R.id.w_title, day.equals(td) ? "Heute" : rel(day, td));
                v.setTextViewText(R.id.w_badge, weekday(day) + " " + shortDate(day));
                v.setViewVisibility(R.id.w_badge, View.VISIBLE);
                JSONArray a = days.optJSONArray(day);
                int nm = nowMin();
                int start = 0;
                if (day.equals(td)) {
                    // vergangene Stunden überspringen, wenn der Platz knapp ist
                    for (int i = 0; i < a.length(); i++) {
                        if (minutes(a.optJSONObject(i).optString("e")) > nm) { start = i; break; }
                    }
                    if (a.length() - start < max) start = Math.max(0, a.length() - max);
                }
                for (int i = start; i < a.length() && added < max; i++) {
                    JSONObject l = a.optJSONObject(i);
                    boolean cancel = l.optInt("x") == 1;
                    boolean now = day.equals(td) && minutes(l.optString("s")) <= nm && minutes(l.optString("e")) > nm;
                    boolean past = day.equals(td) && minutes(l.optString("e")) <= nm;
                    String room = l.optString("r");
                    String sub = cancel ? "Entfällt" : (now ? "● Jetzt · " : "") + (room.isEmpty() ? "" : "Raum " + room + " · ") + l.optString("s") + "–" + l.optString("e");
                    v.addView(R.id.w_rows, row(c, (l.optInt("p") + 1) + ".", l.optString("t"), sub, color(l.optString("c"), accent), past || cancel));
                    added++;
                }
            }
            v.setOnClickPendingIntent(R.id.w_root, open(c, "/timetable", TODAY));
        } else if (type == TASKS) {
            v.setImageViewResource(R.id.w_icon, R.drawable.w_ic_tasks);
            v.setTextViewText(R.id.w_title, "Aufgaben");
            int count = d.optInt("taskCount");
            v.setTextViewText(R.id.w_badge, count + " offen");
            v.setViewVisibility(R.id.w_badge, View.VISIBLE);
            JSONArray a = d.optJSONArray("tasks");
            for (int i = 0; a != null && i < a.length() && added < max; i++) {
                JSONObject t = a.optJSONObject(i);
                String due = t.optString("d");
                int prio = t.optInt("p");
                int bar = prio == 2 ? 0xFFDC2626 : prio == 1 ? 0xFFEA580C : 0xFF94A3B8;
                String label = due.isEmpty() ? "" : rel(due, td);
                String sub = label + (t.optString("k").isEmpty() ? "" : (label.isEmpty() ? "" : " · ") + t.optString("k"));
                if (!due.isEmpty() && daysBetween(td, due) < 0) bar = 0xFFDC2626;
                v.addView(R.id.w_rows, row(c, prio == 2 ? "!!" : prio == 1 ? "!" : "○", t.optString("t"), sub, bar, false));
                added++;
            }
            if (added == 0) empty = "Alles erledigt! 🎉";
            v.setOnClickPendingIntent(R.id.w_root, open(c, "/tasks", TASKS));
        } else {
            v.setImageViewResource(R.id.w_icon, R.drawable.w_ic_agenda);
            v.setTextViewText(R.id.w_title, "Termine & Prüfungen");
            v.setViewVisibility(R.id.w_badge, View.GONE);
            JSONArray a = d.optJSONArray("agenda");
            for (int i = 0; a != null && i < a.length() && added < max; i++) {
                JSONObject e = a.optJSONObject(i);
                String day = e.optString("d");
                if (day.compareTo(td) < 0) continue;
                String time = daysBetween(td, day) == 0 ? "Heute" : daysBetween(td, day) == 1 ? "Morgen" : weekday(day) + "\n" + shortDate(day);
                v.addView(R.id.w_rows, row(c, time, e.optString("t"), e.optString("s"), color(e.optString("c"), accent), false));
                added++;
            }
            if (added == 0) empty = "Keine Termine in den nächsten Wochen.";
            v.setOnClickPendingIntent(R.id.w_root, open(c, "/calendar", AGENDA));
        }
        if (empty != null) {
            v.setTextViewText(R.id.w_empty, empty);
            v.setViewVisibility(R.id.w_empty, View.VISIBLE);
            if (!d.has("days")) v.setOnClickPendingIntent(R.id.w_root, open(c, "/today", type));
        } else {
            v.setViewVisibility(R.id.w_empty, View.GONE);
        }
        return v;
    }

    // ------------------------------------------------------------------ Nächste Stunde

    private static RemoteViews buildNext(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_next);
        String td = today();
        JSONObject days = d.optJSONObject("days");
        String label = "SCHULPLAN", title = "Keine Stunde", meta = "In den nächsten Tagen frei 🎉";
        String route = "/today";
        if (days == null) {
            meta = "App einmal öffnen";
        } else {
            int nm = nowMin();
            boolean found = false;
            JSONArray a = days.optJSONArray(td);
            for (int i = 0; a != null && i < a.length() && !found; i++) {
                JSONObject l = a.optJSONObject(i);
                if (l.optInt("x") == 1) continue;
                int s = minutes(l.optString("s")), e = minutes(l.optString("e"));
                if (nm >= s && nm < e) {
                    label = "JETZT · " + (l.optInt("p") + 1) + ". STUNDE";
                    title = l.optString("t");
                    meta = (l.optString("r").isEmpty() ? "" : "Raum " + l.optString("r") + " · ") + "noch " + (e - nm) + " Min.";
                    route = "/lesson/" + td + "/" + l.optInt("p");
                    found = true;
                } else if (nm < s) {
                    int in = s - nm;
                    label = "ALS NÄCHSTES · " + (in < 60 ? "IN " + in + " MIN." : l.optString("s"));
                    title = l.optString("t");
                    meta = (l.optString("r").isEmpty() ? "" : "Raum " + l.optString("r") + " · ") + l.optString("s") + "–" + l.optString("e");
                    route = "/lesson/" + td + "/" + l.optInt("p");
                    found = true;
                }
            }
            if (!found) {
                for (int k = 1; k < 8 && !found; k++) {
                    String day = addDays(td, k);
                    JSONArray b = days.optJSONArray(day);
                    for (int i = 0; b != null && i < b.length(); i++) {
                        JSONObject l = b.optJSONObject(i);
                        if (l.optInt("x") == 1) continue;
                        label = (k == 1 ? "MORGEN" : weekday(day).toUpperCase(Locale.GERMANY) + " " + shortDate(day)) + " · " + (l.optInt("p") + 1) + ". STD.";
                        title = l.optString("t");
                        meta = (l.optString("r").isEmpty() ? "" : "Raum " + l.optString("r") + " · ") + l.optString("s") + " Uhr";
                        route = "/lesson/" + day + "/" + l.optInt("p");
                        found = true;
                        break;
                    }
                }
            }
        }
        v.setTextViewText(R.id.n_label, label);
        v.setTextViewText(R.id.n_title, title);
        v.setTextViewText(R.id.n_meta, meta);
        v.setOnClickPendingIntent(R.id.n_root, open(c, route, NEXT));
        return v;
    }

    // ------------------------------------------------------------------ Basisklasse

    public abstract static class Base extends AppWidgetProvider {
        abstract int type();

        @Override
        public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
            update(c, m, ids, type());
        }

        @Override
        public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) {
            update(c, m, new int[]{id}, type());
        }
    }
}
