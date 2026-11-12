/*
 * Konfiguration der Gästeliste.
 * Hier änderst du alles, was sich ohne Programmierkenntnisse anpassen lässt.
 */
window.GAESTELISTE_CONFIG = {
  // URL der veröffentlichten Google-Apps-Script-Web-App (endet auf /exec).
  // Siehe README, Abschnitt "Backend einrichten".
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzktzgqQjfvP-3tLIPJ02qynfATsWY0h12mSLOOhq1pY_iCX4oy7rgqxiWFhGACLl8RmA/exec",

  // Mindestalter am Eventtag. Muss mit MIN_AGE in apps-script/Code.gs übereinstimmen.
  MIN_AGE: 18,

  // Zeitlimit für das Absenden in Millisekunden.
  REQUEST_TIMEOUT_MS: 20000,

  // Eventdaten (für Altersprüfung und Kalenderdatei .ics).
  // Wenn du hier etwas änderst, passe auch den Text in index.html an.
  EVENT: {
    title: "FourZed x F32 x sync. Secret Session",
    date: "2026-11-14",      // JJJJ-MM-TT
    startTime: "19:00",      // HH:MM, Ortszeit
    endTime: "22:00",        // HH:MM, Ortszeit
    timezone: "Europe/Berlin",
    location: "Praterinsel 3, 80538 München",
    description: "Private Party mit Gästeliste."
  }
};
