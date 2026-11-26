# Schulplan – Der Organisations-Planer für Lehrkräfte der Astrid Lindgren Schule

Eine Android-App, die den Schulalltag für Lehrerinnen und Lehrer organisiert. Sie arbeitet komplett **offline**, die Daten bleiben **auf dem Gerät**, und es gibt keine Werbung und kein Konto.

📦 **Android:** [`release/Schulplan.apk`](release/Schulplan.apk) (Android 7.0 oder neuer)  
🖥️ **Windows:** [`release/Schulplan-Setup.exe`](release/Schulplan-Setup.exe) (Windows 10/11, 64 Bit)  
🌐 **Web-App (ohne Installationsdatei, auch iPhone/iPad):** https://superali99-tech.github.io/Schul-Organisation-App/app/  
🍎 **Mac:** [`Schulplan-Mac-AppleSilicon.zip`](release/Schulplan-Mac-AppleSilicon.zip) (M1/M2/M3/M4) · [`Schulplan-Mac-Intel.zip`](release/Schulplan-Mac-Intel.zip) (ältere Macs) – macOS 11 oder neuer  
🐧 **Linux:** [`Schulplan-Linux.deb`](release/Schulplan-Linux.deb) (Ubuntu, Linux Mint, Debian) · [`Schulplan-Linux.AppImage`](release/Schulplan-Linux.AppImage) (alle anderen, 64 Bit)

🌐 **Website:** https://superali99-tech.github.io/Schul-Organisation-App/ – Downloads, ausführliche Anleitung, Datenschutzerklärung, Nutzungsrichtlinien und Lizenz (Quelle im Ordner `docs/`).

**Neu in 1.7:** Design 2.0 mit Farbthemen · Pausenaufsicht mit Erinnerung · Räume buchen · Umfragen · Statistik für die Schulleitung · **1.6:** Vertretung gezielt zuweisen – nur die Vertretung bekommt die Meldung (oder auf Wunsch alle), Meldung mit einem Tipp versenden, Anleitungs-Video · **1.5:** Schulleitermodus mit Cockpit · Abwesenheit melden · Linux-Version · Zahl am App-Symbol der Web-App · bessere Darstellung auf iPhone/iPad.

**Neu in 1.3.2:** Mac-Version · Update-Suche mit Zeitlimit (kein endloses Suchen mehr).

**Neu in 1.3.1:** Windows-Version · Seitenleiste für große Bildschirme · Zurück-Taste, Update-Prüfung und Cloud-Abgleich repariert.

**Neu in 1.3:** Automatische Updates in der App · Benachrichtigungen für Stunden, Termine, Aufgaben, Hausaufgaben, Prüfungen, Geburtstage, Ferien und eine Morgen-Übersicht · Startbildschirm mit Logo statt schwarzem Bildschirm.

**Neu in 1.2:** 4 Startbildschirm-Widgets (Stundenplan heute, Nächste Stunde, Aufgaben, Termine & Prüfungen) · kein weißes Aufblitzen mehr beim Start.

**Neu in 1.1:** Kollegium – Kolleg:innen der eigenen Schule einladen und zusammenarbeiten · komplett überarbeitetes, modernes Design.

---

## Installation auf dem Handy oder Tablet

1. `release/Schulplan.apk` aufs Gerät laden (z. B. über GitHub im Browser → „Download“).
2. Die Datei antippen. Android fragt beim ersten Mal, ob der Browser bzw. Dateimanager **„Apps aus unbekannten Quellen installieren“** darf → erlauben.
3. Auf **Installieren** tippen und die App „Schulplan“ öffnen.
4. Beim ersten Start legst du deinen Namen und dein Notensystem fest – oder lädst zum Ausprobieren die **Beispieldaten**.

> **Updates kommen automatisch:** Ab Version 1.3 prüft die App selbst auf neue Versionen, zeigt „Neue Version verfügbar“ mit den Neuerungen und installiert sie mit einem Tipp. Die Daten bleiben dabei erhalten. Nur Version 1.3 selbst muss einmalig per Hand installiert werden.

## Installation unter Windows

1. [`release/Schulplan-Setup.exe`](release/Schulplan-Setup.exe) herunterladen und doppelklicken.
2. Windows zeigt eventuell „Der Computer wurde durch Windows geschützt“ (die App ist nicht kostenpflichtig signiert): auf **Weitere Informationen → Trotzdem ausführen** klicken.
3. Schulplan installiert sich ohne Administratorrechte und legt ein Symbol auf dem **Desktop** und im **Startmenü** an.

Die Windows-Version hat dieselben Funktionen wie die Android-App, dazu eine Seitenleiste für große Bildschirme. Daten liegen unter `%APPDATA%\Schulplan` (mit täglichen automatischen Sicherungen). Beim Schließen läuft Schulplan im Infobereich (unten rechts) weiter, damit Erinnerungen ankommen; **Rechtsklick → Beenden** schließt die App ganz. Updates installiert die App selbst. Dateien (Team-Pakete, Einladungen, Sicherungen) kann man einfach ins Fenster ziehen.

**Daten zwischen Handy und PC übertragen:** Am Handy *Mehr → Datensicherung → Sicherung exportieren*, die Datei auf den PC bringen und in Schulplan für Windows wiederherstellen (oder ins Fenster ziehen).

## Installation auf dem Mac

1. Passende Datei laden: **Apple Silicon** (Macs ab Ende 2020 mit M1/M2/M3/M4) oder **Intel** (ältere Macs). Welcher Chip drinsteckt, steht unter  → *Über diesen Mac*.
2. Die ZIP-Datei doppelklicken – es erscheint **Schulplan**. Diese App in den Ordner **Programme** ziehen.
3. Beim ersten Öffnen warnt macOS, weil die App nicht über ein kostenpflichtiges Apple-Entwicklerkonto signiert ist:
   * **Rechtsklick auf Schulplan → Öffnen → Öffnen**, oder
   * unter **Systemeinstellungen → Datenschutz & Sicherheit** ganz unten auf **„Dennoch öffnen“** klicken.
   * Meldet macOS *„ist beschädigt“*, einmalig im Programm **Terminal** eingeben: `xattr -cr /Applications/Schulplan.app` – danach startet die App normal.

Daten liegen unter `~/Library/Application Support/Schulplan` (mit täglichen Sicherungen). Beim Schließen des Fensters bleibt Schulplan im Dock aktiv, damit Erinnerungen ankommen; **⌘Q** beendet die App. Neue Versionen meldet die App selbst und lädt sie in den Download-Ordner (dann entpacken und in *Programme* ersetzen).

## Installation unter Linux

* **Ubuntu, Linux Mint, Debian:** `Schulplan-Linux.deb` doppelklicken und installieren – oder im Terminal: `sudo apt install ./Schulplan-Linux.deb`. Schulplan erscheint danach im Anwendungsmenü.
* **Andere Systeme (Fedora, openSUSE, Arch …):** `Schulplan-Linux.AppImage` laden, ausführbar machen (Rechtsklick → Eigenschaften → „Als Programm ausführen“ bzw. `chmod +x Schulplan-Linux.AppImage`) und doppelklicken. Startet es unter Ubuntu nicht, fehlt FUSE: `sudo apt install libfuse2` (24.04: `libfuse2t64`).

Daten liegen unter `~/.config/Schulplan` (mit täglichen Sicherungen). Beim Schließen läuft Schulplan im Hintergrund weiter, damit Erinnerungen ankommen; **Strg+Q** beendet die App, **Strg+Umschalt+W** schaltet das Desktop-Widget ein. Updates: Das AppImage ersetzt sich selbst; beim .deb fragt das System einmal nach dem Passwort.

## Schulleitermodus

Unter **Mehr → Schulleitermodus** meldet sich die Schulleitung mit eigenen Zugangsdaten an (Name und Passwort, änderbar unter *Einstellungen → Schulleitermodus*; gespeichert nur als verschlüsselter Prüfwert). Das **Cockpit** zeigt Kollegium, heutige Abwesenheiten, offene Vertretungen, Lesebestätigungen und die nächsten Schultermine. Die Schulleitung kann

* **verbindliche Termine** und **Pflichttermine** (Erinnerung am Vortag) für alle anlegen,
* **Mitteilungen** mit **Lesebestätigung** verschicken,
* **Schulvorgaben** (Schuljahr, Stundenraster, Fächer) verbindlich verteilen – die Geräte übernehmen sie automatisch,
* Ferien festlegen, die **Jahresplanung** ansehen und exportieren,
* das **Kollegium verwalten** (Mitglieder entfernen, Schulleitung übergeben).

Verbindliche Einträge werden mit einem ECDSA-Schlüssel des Schulleitungs-Geräts **digital unterschrieben**; andere Geräte prüfen die Unterschrift beim Abgleich und lehnen Änderungen, Löschungen oder Fälschungen ab. Lehrkräfte melden **Abwesenheiten** (ihre betroffenen Stunden gehen automatisch an die Vertretungsplanung) und bestätigen Mitteilungen.

## Aufsicht, Räume & Umfragen

Unter *Kollegium* gibt es die Reiter **Aufsicht** (Pausenaufsichtsplan der Schulleitung; jede Lehrkraft sieht ihre Aufsichten auf der Startseite und wird 5 Minuten vorher erinnert; fehlt jemand, kann die Schulleitung die Aufsicht für diesen Tag vertreten lassen), **Räume** (buchbare Räume wie Computerraum oder Aula mit Wochenübersicht; freie Stunde antippen = buchen) und **Umfragen** (abstimmen mit Live-Ergebnis, optional anonym und mit Frist). Die Schulleitung findet im Cockpit außerdem eine **Statistik** zu Vertretungen, Abwesenheitstagen, Aufsichten und gelesenen Mitteilungen (CSV-Export). Aufsichtsplan und Räume sind – sobald eine Schulleitung eingetragen ist – digital unterschrieben und nur von ihr änderbar.

## Chat im Kollegium

Unter *Mehr → Chat* schreiben sich Lehrkräfte und Schulleitung gegenseitig: Einzelchats, **Gruppen** (Name, Symbol, Mitglieder) und der Chat **Ganzes Kollegium**. Es gibt **Emojis**, **Reaktionen**, **Fotos** (automatisch verkleinert), **Sprachnachrichten** (bis 2 Minuten), „Für alle löschen“ und **Storys** (Text oder Foto, 24 Stunden sichtbar). **Anrufen** öffnet die Telefon-App, **Videoanruf** verschickt einen Link zu einem Jitsi-Raum (Server unter *Einstellungen → Videoanrufe im Chat* änderbar).

Jede Nachricht wird zusätzlich nur für die Mitglieder des Chats verschlüsselt (ECDH P-256 + AES-GCM); gefälschte Absender werden markiert. Zugestellt wird über den Team-Abgleich: mit verbundener Cloud-Datei alle 15 Sekunden bei geöffnetem Chat, sonst beim Öffnen der App oder per „Senden“. Ein Live-Messenger mit Server ist das nicht. Nachrichten werden nach 30 Tagen gelöscht, Storys nach 24 Stunden. Videos lassen sich nur als Link teilen.

## Assistent

Das ✨-Symbol auf der Startseite öffnet den **Assistenten**. Offline versteht er Befehle wie „Erinnere mich morgen um 7 an die Kopien“, „Erstelle Aufgabe … bis Freitag“, „Verschiebe Termin … auf den 15.12.“, „Lösche Termin …“, „Was steht morgen an?“ oder „Öffne Kalender“.

Optional gibt es den **KI-Modus** mit Claude (Anthropic): Im Assistenten auf das Zahnrad tippen, „KI-Modus“ wählen und einen **eigenen API-Schlüssel** von console.anthropic.com eintragen (Nutzung kostet pro Anfrage). Dann versteht der Assistent freie Fragen und kann Termine, Aufgaben, Hausaufgaben und Notizen anlegen, ändern und löschen – vor dem Löschen fragt die App nach. Der Schlüssel bleibt nur auf dem Gerät. Im KI-Modus werden Fragen und die nötigen Einträge an Anthropic gesendet; Schülerdaten nur, wenn „Schülerdaten freigeben“ eingeschaltet ist.

## Vertretung zuweisen

*Kollegium → Vertretungen → + Vertretung*: Tag, Stunde, Klasse, abwesende Lehrkraft und Vertretung wählen. Unter **„Wer bekommt die Meldung?“** entscheidest du: **Nur die Vertretung** (sichtbar nur für Vertretung, abwesende Lehrkraft und Schulleitung) oder **Ganzes Kollegium**. Danach **Meldung jetzt senden** (WhatsApp, E-Mail … mit Team-Datei) – die Kollegin öffnet die Datei, sieht „Du vertrittst …“ und hat die Stunde im Stundenplan. Ein kurzes Anleitungs-Video gibt es in der App unter *Vertretungen → So geht's* und in den Neuerungen.

## Kollegium: mit anderen Lehrkräften der Schule zusammenarbeiten

Unter **Mehr → Kollegium** gründet eine Lehrkraft das Schulteam und lädt andere ein:

* **QR-Code** im Lehrerzimmer: Die Kollegin öffnet Schulplan → Kollegium → *Einladung annehmen* → *QR-Code scannen*.
* **Nachricht** per WhatsApp, E-Mail oder SMS: Der Code ist mit einer 4-stelligen **PIN verschlüsselt**, die man persönlich weitergibt.
  Zum Beitreten: Kollegium → *Einladung annehmen* → *Einladungs-Nachricht einfügen* → die ganze Nachricht einfügen **und** die PIN ins PIN-Feld eingeben. Die PIN allein reicht nicht.
* **App weitergeben:** Die APK lässt sich direkt aus der App teilen (Nearby Share, Bluetooth, Messenger).

Gemeinsam genutzt werden:

| | |
|---|---|
| **Schwarzes Brett** | Mitteilungen an das ganze Kollegium, wichtig markieren, anheften |
| **Kollegium** | Liste aller Mitglieder mit Kürzel, Funktion, Fächern; Anruf/E-Mail per Tippen |
| **Schultermine & Ferien** | Gemeinsame Termine erscheinen bei allen im Kalender |
| **Vertretungsplan** | Vertretungen erscheinen automatisch im Stundenplan der vertretenden Lehrkraft; die eigene Stunde wird als vertreten markiert |
| **Klassenlisten** | Die Klassenleitung teilt die Schülerliste (optional mit Elternkontakten), andere übernehmen sie mit einem Tipp |
| **Schulvorgaben** | Stundenraster, Schuljahr, Fächer und Ferien für neue Mitglieder |

**Noten, Fehlzeiten, Beobachtungen und Notizen bleiben immer privat.**

**Abgleich ohne fremden Server.** Es gibt zwei Wege:
1. *Per Datei:* „Senden“ verschickt eine verschlüsselte Team-Datei (z. B. in die WhatsApp-Gruppe), „Empfangen“ bzw. das Öffnen der Datei übernimmt die Neuigkeiten.
2. *Gemeinsame Cloud-Datei:* Eine Team-Datei liegt in einem freigegebenen Ordner (z. B. Schul-Nextcloud, Google Drive, OneDrive), alle verbinden dieselbe Datei. Die App gleicht dann automatisch beim Öffnen und nach Änderungen ab.

Alle Team-Daten sind Ende-zu-Ende verschlüsselt (AES-256-GCM). Den Schlüssel haben nur Mitglieder, die eine Einladung angenommen haben.

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
| **Chat** | Einzel- und Gruppenchats im Kollegium, Emojis, Reaktionen, Fotos, Sprachnachrichten, Storys, Anruf und Videoanruf per Link, Ende-zu-Ende verschlüsselt |
| **Assistent** | Befehle in Alltagssprache (offline), optional KI-Modus mit Claude zum Erstellen, Bearbeiten und Löschen |
| **Werkzeuge** | Zufallsauswahl (ohne Wiederholung, Abwesende ausgeschlossen), Gruppen bilden (gemischt), Timer & Stoppuhr, **Lautstärke-Ampel** (Mikrofon), Ampel, Notenschlüssel-Rechner, Notenrechner, Würfel/Münze/Zufallszahl, Stundenuhr |
| **Statistik** | Leistung je Klasse, Anwesenheitsquoten, gefährdete Schüler:innen |
| **Erinnerungen** | Benachrichtigungen für Prüfungen, Termine, Aufgaben, Wiedervorlagen und optional vor jeder Stunde |
| **Sicherheit** | PIN-Sperre, Bildschirmfotos verhindern, Internet nur für Updates und – wenn du sie nutzt – KI-Modus und Videoanrufe |
| **Daten** | Sicherung exportieren/wiederherstellen (.json), tägliche automatische Sicherungen auf dem Gerät, CSV-Exporte, Schuljahreswechsel, Drucken bzw. PDF über Android |
| **Darstellung** | Modernes Design mit Farbverläufen und schwebender Navigation, Hell/Dunkel/System, Akzentfarbe, Schriftgröße, für Handy und Tablet |

## Datenschutz

* Alle Daten liegen nur im privaten App-Speicher auf dem Gerät. Das Internet wird für die **Update-Prüfung** genutzt (Abruf von `release/version.json`); dabei werden keine Schul- oder Schülerdaten übertragen.
* Nur wenn du ihn selbst einschaltest, sendet der **KI-Modus** des Assistenten deine Fragen und die dafür nötigen Einträge an die Claude-API von Anthropic (Schülerdaten nur mit ausdrücklicher Freigabe). **Videoanrufe** laufen über den gewählten Jitsi-Server.
* Für Android-Cloud-Backups ist die App gesperrt. Gesichert wird nur, was du selbst exportierst.
* Bitte beachte die Vorgaben deines Bundeslandes zur Verarbeitung von Schülerdaten auf privaten Geräten. Die PIN-Sperre ist empfohlen.

## Neue Version veröffentlichen (für alle Lehrkräfte)

1. In `app/build.gradle` `versionCode` um 1 erhöhen und `versionName` anpassen.
2. In `app/src/main/assets/www/js/views/update.js` einen Eintrag oben in `CHANGELOG` ergänzen (wird nach dem Update als „Neu in …“ angezeigt).
3. `./gradlew assembleRelease` und die APK nach `release/Schulplan.apk` kopieren.
4. In `release/version.json` `versionCode`, `versionName`, `date` und `notes` anpassen.
5. Windows: In `desktop/package.json` `version` anpassen, `cd desktop && npm install && npm run dist`, dann `desktop/dist/Schulplan-Setup.exe` nach `release/` kopieren und in `release/version.json` den Block `desktop` anpassen.
   Mac: `npm run dist-mac`, die beiden ZIPs aus `desktop/dist/` als `Schulplan-Mac-AppleSilicon.zip` / `Schulplan-Mac-Intel.zip` nach `release/` kopieren und den Block `mac` anpassen.
   Linux: `npm run dist-linux`, `Schulplan-Linux.deb` und `Schulplan-Linux.AppImage` aus `desktop/dist/` nach `release/` kopieren und den Block `linux` anpassen.
6. Committen und pushen – alle installierten Apps sehen die neue Version beim nächsten Öffnen bzw. per Benachrichtigung (Prüfung etwa zweimal täglich).

Die App lädt `https://raw.githubusercontent.com/superali99-tech/Schul-Organisation-App/HEAD/release/version.json`. Das Repository muss dafür öffentlich sein (oder in der App unter *App-Updates → Update-Quelle* eine andere Adresse eingetragen werden). Android installiert ein Update nur, wenn es mit demselben Schlüssel signiert ist.

## Website (GitHub Pages)

Die Website liegt im Ordner `docs/` (reines HTML/CSS, keine Cookies, kein Tracking, Schriften lokal). Einmalig einschalten: GitHub → *Settings* → *Pages* → *Build and deployment*: „Deploy from a branch“, Branch `ccr-c2cca40c-1fdkle` (bzw. der Standard-Branch), Ordner `/docs` → *Save*. Nach einer Minute ist sie unter https://superali99-tech.github.io/Schul-Organisation-App/ erreichbar. Bei neuen Versionen Versionsnummern, Größen und Prüfsummen in `docs/index.html` und `docs/script.js` anpassen und die Web-App mit `node tools/build-webapp.js` neu nach `docs/app/` bauen.

**Windows meldet „Smart App Control hat eine App blockiert“:** Diese Windows-11-Funktion lässt unsignierte Programme gar nicht starten (kein „Trotzdem ausführen“). Abhilfe: die Web-App nutzen (in Edge/Chrome als App installieren) oder Smart App Control unter *Windows-Sicherheit → App- & Browsersteuerung* ausschalten. Dauerhaft hilft nur ein Code-Signing-Zertifikat.

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

Symbole: [Lucide](https://lucide.dev) (ISC-Lizenz, `tools/LUCIDE-LICENSE.txt`) · Schrift: [Inter](https://rsms.me/inter/) (SIL Open Font License, `tools/INTER-FONT-LICENSE.txt`) · QR-Codes: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) und [jsQR](https://github.com/cozmo/jsQR) (Apache 2.0, `tools/JSQR-LICENSE.txt`).
