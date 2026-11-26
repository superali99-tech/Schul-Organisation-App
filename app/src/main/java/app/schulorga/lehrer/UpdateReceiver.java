package app.schulorga.lehrer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Prüft im Hintergrund (ca. zweimal täglich) auf eine neue App-Version. */
public class UpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        final PendingResult r = goAsync();
        new Thread(() -> {
            try {
                Updater.backgroundCheck(c.getApplicationContext());
            } finally {
                r.finish();
            }
        }).start();
    }
}
