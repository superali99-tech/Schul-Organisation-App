package app.schulorga.lehrer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Plant nach einem Neustart bzw. Update alle Erinnerungen erneut ein. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Reminders.rescheduleAll(c);
        Widgets.updateAll(c);
    }
}
