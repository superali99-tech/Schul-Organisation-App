# SchulOrga – Der Organisations-Planer für Lehrkräfte

Eine Android-App, die den Schulalltag für Lehrerinnen und Lehrer organisiert. Sie arbeitet komplett **offline**, die Daten bleiben **auf dem Gerät**, und es gibt keine Werbung und kein Konto.

📦 **APK zum Installieren:** [`release/SchulOrga-1.0.0.apk`](release/SchulOrga-1.0.0.apk) (ca. 500 KB, Android 7.0 oder neuer)

---

## Installation auf dem Handy oder Tablet

1. `release/SchulOrga-1.0.0.apk` aufs Gerät laden (z. B. über GitHub im Browser → „Download“).
2. Die Datei antippen. Android fragt beim ersten Mal, ob der Browser bzw. Dateimanager **„Apps aus unbekannten Quellen installieren“** darf → erlauben.
3. Auf **Installieren** tippen und die App „SchulOrga“ öffnen.
4. Beim ersten Start legst du deinen Namen und dein Notensystem fest – oder lädst zum Ausprobieren die **Beispieldaten**.

> Updates: Eine neuere APK lässt sich einfach über die alte installieren. Die Daten bleiben dabei erhalten.

## Funktionen

| Bereich | Was die App kann |
|---|---|
| **Heute** | Begrüßung, aktuelle/nächste Stunde mit Restzeit, Tagesplan, fällige Aufgaben & Hausaufgaben, anstehende Prüfungen, Termine, Geburtstage, Wiedervorlagen |
| **Stundenplan** | Wochenansicht, frei einstellbares Stundenraster (mit Generator), 5- oder 6-Tage-Woche, **A/B-Wochen**, Doppelstunden, Aufsichten, Ferien werden ausgeblendet, Drucken |
| **Vertretungen** | Ausfall, Raumänderung, eigene Vertretungsstunden, Verlegungen – erscheinen automatisch im Plan |
| **Unterrichtsstunde** | Klassenbuch (Thema, Verlauf, Status), Hausaufgabe aufgeben (fällig zur nächsten Stunde), Anwesenheit, Mitarbeit +/– pro Kind, Thema der letzten Stunde, anstehende Prüfung |
| **Klassen & Schüler** | Klassen/Kurse mit Fächern, Raum, Farbe, Klassenleitung, Archiv; Schülerprofile mit Foto, Geburtstag, Eltern-Kontakten (Anruf/E-Mail per Tippen), Merkmalen (z. B. LRS, Nachteilsausgleich); Import als Liste oder **CSV** |
| **Noten** | Noten 1–6 (mit +/–) **oder** Punkte 0–15 (pro Klasse wählbar), Kategorien mit Gewichtung (pro Klasse anpassbar), Notentabelle, Halbjahresfilter, Zeugnisnote, Schnelleingabe |
| **Leistungsnachweise** | Klassenarbeiten/Tests mit Punkteeingabe und automatischer Note über den **Notenschlüssel** (pro Arbeit anpassbar), **Notenspiegel** als Diagramm, Warnung bei über ⅓ Fünfen/Sechsen, Teilen & Drucken, Kopieren für Parallelklassen |
| **Anwesenheit** | Pro Tag oder Stunde: unentschuldigt, entschuldigt, verspätet (mit Minuten), beurlaubt; Statistik und Quote je Kind, CSV-Export |
| **Mitarbeit & Beobachtungen** | Mitarbeit +/–, Hausaufgabe/Material vergessen, Störungen, Lob, freie Notizen |
| **Hausaufgaben** | Pro Klasse mit Fälligkeit, Kontrolle „Wer hat sie nicht?“ (wird im Schülerprofil vermerkt) |
| **Klassenbuch & Planung** | Stundenplanung (Ziele, Phasen, Material), Unterrichtsreihen mit Fortschritt, Klassenbuch drucken/exportieren |
| **Sitzplan** | Raster frei einstellbar, Gänge, Tafel oben/unten, zufällig verteilen, Plätze tauschen, Abwesende ausgegraut, Drucken |
| **Kalender** | Monat und Liste, Termine (Konferenz, Elternabend, Ausflug, Aufsicht, Fristen …), Ferien & freie Tage, alles in einer Ansicht; Export als **.ics** für Google/Outlook |
| **Aufgaben** | To-dos mit Priorität, Kategorie, Fälligkeit, Wiederholung und Erinnerung |
| **Notizen** | Farbige Notizen, Anheften, Checklisten, Suche, Zuordnung zu Klassen |
| **Elterngespräche** | Protokolle mit Teilnehmenden, Vereinbarungen und Wiedervorlage, druckbar mit Unterschriftenfeld |
| **Werkzeuge** | Zufallsauswahl (ohne Wiederholung, Abwesende ausgeschlossen), Gruppen bilden (gemischt), Timer & Stoppuhr, **Lautstärke-Ampel** (Mikrofon), Ampel, Notenschlüssel-Rechner, Notenrechner, Würfel/Münze/Zufallszahl, Stundenuhr |
| **Statistik** | Leistung je Klasse, Anwesenheitsquoten, gefährdete Schüler:innen |
| **Erinnerungen** | Benachrichtigungen für Prüfungen, Termine, Aufgaben, Wiedervorlagen und optional vor jeder Stunde |
| **Sicherheit** | PIN-Sperre, Bildschirmfotos verhindern, keine Internet-Berechtigung |
| **Daten** | Sicherung exportieren/wiederherstellen (.json), tägliche automatische Sicherungen auf dem Gerät, CSV-Exporte, Schuljahreswechsel, Drucken bzw. PDF über Android |
| **Darstellung** | Hell/Dunkel/System, Akzentfarbe, Schriftgröße, für Handy und Tablet |

## Datenschutz

* Alle Daten liegen nur im privaten App-Speicher auf dem Gerät. Die App hat **keine Internet-Berechtigung**.
* Für Android-Cloud-Backups ist die App gesperrt. Gesichert wird nur, was du selbst exportierst.
* Bitte beachte die Vorgaben deines Bundeslandes zur Verarbeitung von Schülerdaten auf privaten Geräten. Die PIN-Sperre ist empfohlen.

## Technik & selbst bauen

* Native Android-Hülle (Java, ohne Fremdbibliotheken) mit WebView-Oberfläche in `app/src/main/assets/www` (HTML/CSS/JavaScript).
* Die Oberfläche wird über eine virtuelle HTTPS-Adresse aus den App-Assets geladen. Daten speichert sie per JS-Bridge als JSON-Datei, mit täglichen Auto-Backups.
* Erinnerungen laufen über den `AlarmManager` und werden nach einem Neustart neu eingeplant.

```bash
# Voraussetzungen: JDK 17+, Android SDK (Plattform 35, Build-Tools 35)
echo "sdk.dir=/pfad/zum/android-sdk" > local.properties
./gradlew assembleRelease
# Ergebnis: app/build/outputs/apk/release/app-release.apk
```

Die Oberfläche lässt sich auch im Browser testen:

```bash
cd app/src/main/assets/www && python3 -m http.server 8765
# http://localhost:8765/index.html öffnen
```

**Signatur:** Der Schlüssel unter `keystore/` dient nur der Sideload-Installation. Er ist absichtlich im Repository, damit jede Neuerstellung die installierte App aktualisieren kann, ohne Datenverlust. Für eine Veröffentlichung im Play Store bitte einen eigenen, geheimen Schlüssel verwenden (Umgebungsvariablen `SCHULORGA_KEYSTORE`, `SCHULORGA_STORE_PASSWORD`, `SCHULORGA_KEY_ALIAS`, `SCHULORGA_KEY_PASSWORD`).

Symbole: [Lucide](https://lucide.dev) (ISC-Lizenz, siehe `tools/LUCIDE-LICENSE.txt`).
