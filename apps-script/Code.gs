/**
 * Gästeliste – Google Apps Script Backend
 *
 * Bereitstellen als Web-App: Ausführen als "Ich", Zugriff "Jeder".
 * Das Frontend sendet JSON per POST mit Content-Type text/plain.
 *
 * Antworten (immer HTTP 200, JSON):
 *   { ok: true }
 *   { ok: false, code: "DUPLICATE" | "FULL" | "INVALID" | "BUSY" | "BAD_REQUEST" | "SERVER_ERROR",
 *     field?: "...", message: "..." }
 */

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

/** Name des Tabellenblatts. Wird automatisch angelegt, falls es fehlt. */
const SHEET_NAME = 'Gästeliste';

/** Mindestalter am Eventtag. Muss mit MIN_AGE in config.js übereinstimmen. */
const MIN_AGE = 18;

/** Eventdatum (JJJJ-MM-TT) für die Altersprüfung. */
const EVENT_DATE = '2026-11-14';

/** Maximale Anzahl Gäste inkl. Begleitpersonen. 0 = unbegrenzt. */
const MAX_GUESTS = 0;

/** Erlaubte Werte für "Über wen kommst du?". */
const VIA_OPTIONS = ['sync.', 'F32', 'FourZed'];

/** Maximale Anzahl Begleitpersonen pro Anmeldung. */
const MAX_COMPANIONS = 5;

const HEADERS = ['Zeitstempel', 'Vorname', 'Nachname', 'Geburtsdatum', 'E-Mail', 'Kommt über', 'Newsletter', 'Begleitpersonen'];
const EMAIL_COLUMN = 5; // Spalte E
const NAME_MAX = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

// ---------------------------------------------------------------------------
// Web-App-Einstiegspunkte
// ---------------------------------------------------------------------------

/** Statusprüfung: Aufruf der /exec-URL im Browser zeigt, ob die Web-App läuft. */
function doGet() {
  return json_({ ok: true, status: 'online' });
}

function doPost(e) {
  let data;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 10000) throw new Error('empty or too large');
    data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
  } catch (err) {
    return json_({ ok: false, code: 'BAD_REQUEST', message: 'Ungültige Anfrage.' });
  }

  // Honeypot: Bots füllen das versteckte Feld aus. Wir tun so, als hätte alles geklappt.
  if (data.website) {
    return json_({ ok: true });
  }

  const v = validate_(data);
  if (v.error) {
    return json_({ ok: false, code: 'INVALID', field: v.field, message: v.error });
  }
  const guest = v.value;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return json_({ ok: false, code: 'BUSY', message: 'Gerade ist viel los. Bitte versuche es gleich erneut.' });
  }

  try {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    const count = Math.max(0, lastRow - 1);

    if (count > 0) {
      const emails = sheet.getRange(2, EMAIL_COLUMN, count, 1).getValues();
      for (let i = 0; i < emails.length; i++) {
        if (normalizeEmail_(emails[i][0]) === guest.email) {
          return json_({ ok: false, code: 'DUPLICATE', message: 'Du stehst bereits auf der Liste.' });
        }
      }
    }

    if (MAX_GUESTS > 0) {
      let total = 0;
      if (count > 0) {
        const companions = sheet.getRange(2, HEADERS.length, count, 1).getValues();
        for (let i = 0; i < companions.length; i++) total += 1 + (Number(companions[i][0]) || 0);
      }
      if (total + 1 + guest.guests > MAX_GUESTS) {
        return json_({ ok: false, code: 'FULL', message: 'Die Gästeliste ist leider voll.' });
      }
    }

    sheet.appendRow([
      new Date(),
      safe_(guest.firstName),
      safe_(guest.lastName),
      "'" + guest.birthdateDisplay, // immer als Text speichern
      safe_(guest.email),
      safe_(guest.via),
      guest.newsletter ? 'Ja' : 'Nein',
      guest.guests
    ]);
    SpreadsheetApp.flush();

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, code: 'SERVER_ERROR', message: 'Beim Speichern ist ein Fehler aufgetreten.' });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Einmal manuell im Editor ausführen: legt das Tabellenblatt mit Kopfzeile an
 * und fragt die nötigen Berechtigungen ab.
 */
function setup() {
  getSheet_();
}

// ---------------------------------------------------------------------------
// Validierung
// ---------------------------------------------------------------------------

function validate_(d) {
  const firstName = cleanString_(d.firstName);
  const lastName = cleanString_(d.lastName);
  const email = normalizeEmail_(d.email);
  const via = typeof d.via === 'string' ? d.via : '';

  const nameErr = function (v, label) {
    if (!v) return 'Bitte gib deinen ' + label + ' ein.';
    if (v.length > NAME_MAX) return 'Der ' + label + ' darf höchstens ' + NAME_MAX + ' Zeichen lang sein.';
    if (/[\u0000-\u001F\u007F<>]/.test(v)) return 'Der ' + label + ' enthält ungültige Zeichen.';
    return '';
  };

  let msg = nameErr(firstName, 'Vornamen');
  if (msg) return { field: 'firstName', error: msg };
  msg = nameErr(lastName, 'Nachnamen');
  if (msg) return { field: 'lastName', error: msg };

  const b = parseISODate_(d.birthdate);
  if (!b) return { field: 'birthdate', error: 'Bitte gib ein gültiges Geburtsdatum ein.' };
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  if (b.y < 1900 || compareDates_(b, today) > 0) {
    return { field: 'birthdate', error: 'Bitte überprüfe dein Geburtsdatum.' };
  }
  const ev = parseISODate_(EVENT_DATE);
  if (ageOn_(b, ev) < MIN_AGE) {
    return { field: 'birthdate', error: 'Du musst am Eventtag mindestens ' + MIN_AGE + ' Jahre alt sein.' };
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { field: 'email', error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }

  if (VIA_OPTIONS.indexOf(via) === -1) {
    return { field: 'via', error: 'Bitte wähle aus, über wen du kommst.' };
  }

  const guests = d.guests === undefined ? 0 : d.guests;
  if (typeof guests !== 'number' || guests % 1 !== 0 || guests < 0 || guests > MAX_COMPANIONS) {
    return { field: 'guests', error: 'Bitte wähle die Anzahl deiner Begleitpersonen (0 bis ' + MAX_COMPANIONS + ').' };
  }

  if (d.consent !== true) {
    return { field: 'consent', error: 'Bitte stimme der Speicherung deiner Daten zu.' };
  }

  return {
    value: {
      firstName: firstName,
      lastName: lastName,
      birthdateDisplay: pad_(b.d) + '.' + pad_(b.m) + '.' + b.y,
      email: email,
      via: via,
      newsletter: d.newsletter === true,
      guests: guests
    }
  };
}

function cleanString_(v) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

function normalizeEmail_(v) {
  return String(v == null ? '' : v).replace(/^'/, '').trim().toLowerCase();
}

function parseISODate_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y: y, m: mo, d: d };
}

function compareDates_(a, b) {
  return (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
}

function ageOn_(birth, ref) {
  let age = ref.y - birth.y;
  if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) age--;
  return age;
}

function pad_(n) {
  return (n < 10 ? '0' : '') + n;
}

// ---------------------------------------------------------------------------
// Tabelle
// ---------------------------------------------------------------------------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm:ss');
  } else if (sheet.getRange(1, HEADERS.length).getValue() === '') {
    // Bestehende Tabelle: neue Spalte "Begleitpersonen" in der Kopfzeile ergänzen
    sheet.getRange(1, HEADERS.length).setValue(HEADERS[HEADERS.length - 1]).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Schutz vor Formel-Injection (CSV/Spreadsheet Injection):
 * Werte, die mit = + - @ Tab oder CR beginnen, werden mit ' als Text markiert.
 */
function safe_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r＝＋－＠]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
