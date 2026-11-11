# Gästeliste – FourZed x F32 x sync. Community Pop-up

Anmeldeseite für die Gästeliste der privaten Party am **Samstag, 14.11.2026, 19:00 bis 22:00 Uhr**, Praterinsel 3, 80538 München.

- Reines HTML, CSS und Vanilla JS, kein Framework, kein Build-Schritt
- Gehostet auf GitHub Pages, die Anmeldungen landen über Google Apps Script in einem Google Sheet
- Keine Cookies, kein Tracking, keine externen Schriften oder CDNs

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Anmeldeseite mit Formular und Erfolgsansicht |
| `style.css` | Design (Akzentfarbe: `--accent` ganz oben) |
| `script.js` | Validierung, Absenden, Kalenderdatei (.ics) |
| `config.js` | **Web-App-URL**, Mindestalter, Eventdaten |
| `datenschutz.html` | Datenschutzerklärung (**Verantwortlicher muss noch eingetragen werden**) |
| `assets/` | Logos (FourZed, F32, sync.), Schriftzug „Community Pop-up“, Hintergrundbild |
| `apps-script/Code.gs` | Backend für Google Apps Script |

---

## Backend einrichten (Google Sheet + Apps Script)

### 1. Google Sheet anlegen

1. Öffne <https://sheets.new> (mit dem Google-Konto, dem die Daten gehören sollen).
2. Gib der Tabelle einen Namen, z. B. `Gästeliste Community Pop-up`.
3. **Datei → Einstellungen → Allgemein → Zeitzone:** `(GMT+01:00) Berlin` wählen und speichern.

Das Tabellenblatt `Gästeliste` mit den Spalten *Zeitstempel, Vorname, Nachname, Geburtsdatum, E-Mail, Kommt über, Newsletter* wird automatisch angelegt.

### 2. Apps Script einfügen

1. Im Sheet: **Erweiterungen → Apps Script**.
2. Den gesamten Inhalt von `Code.gs` im Editor löschen und durch den Inhalt von [`apps-script/Code.gs`](apps-script/Code.gs) ersetzen.
3. Oben ggf. die Konstanten anpassen:
   - `MIN_AGE` (Standard 18, **muss mit `MIN_AGE` in `config.js` übereinstimmen**)
   - `EVENT_DATE` (Standard `2026-11-14`)
   - `MAX_GUESTS` (Standard `0` = unbegrenzt)
4. Speichern (Disketten-Symbol oder `Cmd/Strg + S`).
5. Links auf **Projekteinstellungen (Zahnrad)** → **Zeitzone**: `(GMT+01:00) Berlin` einstellen.

### 3. Einmal `setup` ausführen (Berechtigungen)

1. Im Editor oben in der Funktionsauswahl `setup` wählen und auf **Ausführen** klicken.
2. Google fragt nach Berechtigungen → **Berechtigungen überprüfen** → dein Konto wählen.
3. Falls „Google hat diese App nicht überprüft“ erscheint: **Erweitert → Zu … wechseln (unsicher)**. Das ist normal für eigene Skripte.
4. **Zulassen** klicken. Danach existiert im Sheet das Blatt `Gästeliste` mit Kopfzeile.

### 4. Als Web-App bereitstellen

1. Oben rechts **Bereitstellen → Neue Bereitstellung**.
2. Beim Zahnrad neben „Typ auswählen“: **Web-App**.
3. Einstellungen:
   - Beschreibung: z. B. `Gästeliste v1`
   - **Ausführen als: Ich** (deine E-Mail-Adresse)
   - **Zugriff: Jeder**
4. **Bereitstellen** klicken und die **Web-App-URL** kopieren (endet auf `/exec`).
5. Test: Die URL im Browser öffnen. Es sollte `{"ok":true,"status":"online"}` erscheinen.

### 5. URL im Frontend eintragen

In `config.js`:

```js
WEB_APP_URL: "https://script.google.com/macros/s/DEINE-ID/exec",
```

Danach committen und pushen (siehe unten). GitHub Pages aktualisiert sich nach ca. 1 Minute.

### Code später ändern

Wenn du `Code.gs` änderst, musst du neu bereitstellen, sonst läuft die alte Version weiter:
**Bereitstellen → Bereitstellungen verwalten → Stift-Symbol → Version: Neue Version → Bereitstellen.**
So bleibt die URL gleich. (Eine *neue* Bereitstellung würde eine neue URL erzeugen.)

---

## Konfiguration

| Was | Wo |
|---|---|
| Web-App-URL | `config.js` → `WEB_APP_URL` |
| Mindestalter | `config.js` → `MIN_AGE` **und** `Code.gs` → `MIN_AGE` |
| Max. Gäste | `Code.gs` → `MAX_GUESTS` (0 = unbegrenzt) |
| Eventdaten (Kalenderdatei, Altersprüfung) | `config.js` → `EVENT` und `Code.gs` → `EVENT_DATE` |
| Eventtexte auf der Seite | `index.html` |
| Akzentfarbe (Pink) | `style.css` → `--accent` und `--accent-rgb` |
| Logos / Hintergrund | Dateien in `assets/` ersetzen (gleicher Dateiname), Logo-Höhen in `style.css` unter `.partner-logos` |

## Funktionen

- Clientseitige Validierung mit deutschen Fehlermeldungen, serverseitig erneut geprüft
- Mindestalter am Eventtag (Geburtstag am Eventtag zählt bereits)
- Doppelanmeldung per E-Mail wird serverseitig erkannt („Du stehst bereits auf der Liste“), Groß-/Kleinschreibung egal
- Honeypot-Feld gegen Spam-Bots, Button wird beim Senden deaktiviert
- `LockService` verhindert, dass gleichzeitige Anfragen doppelte Einträge erzeugen
- Schutz vor Formel-Injection: Werte, die mit `=`, `+`, `-`, `@` usw. beginnen, werden als Text gespeichert
- Erfolgsansicht mit Eventdetails und „Zum Kalender hinzufügen“ (.ics, Zeitzone Europe/Berlin)
- Fehlermeldung mit „Erneut versuchen“, Eingaben bleiben erhalten
- Das Frontend sendet per `fetch` POST mit `Content-Type: text/plain` → kein CORS-Preflight
- `noindex`: Suchmaschinen sollen die Seite nicht aufnehmen (private Party)

## Lokal testen

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Ohne `WEB_APP_URL` zeigt das Formular beim Absenden „Die Anmeldung ist noch nicht eingerichtet.“

## Veröffentlichen (GitHub Pages)

```bash
git add -A && git commit -m "Update" && git push
```

GitHub Pages ist auf Branch `main`, Ordner `/ (root)` eingestellt.

## Datenschutz und rechtliche Hinweise

`datenschutz.html` enthält Standardtexte. Im Abschnitt „Verantwortlicher“ müssen noch Name, Anschrift und E-Mail eingetragen werden (orange markiert). Die Erklärung sagt zu, dass die Gästeliste **spätestens drei Monate nach dem Event gelöscht** wird. Daran müsst ihr euch halten oder den Text anpassen. Die Texte ersetzen keine Rechtsberatung.

Ein Impressum ist bewusst nicht enthalten.

Die Daten im Google Sheet sind personenbezogen (inkl. Geburtsdatum). Teile das Sheet nur mit Personen, die es wirklich brauchen.
