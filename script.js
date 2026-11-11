/* Gästeliste – Formularlogik (Vanilla JS, keine Abhängigkeiten) */
(function () {
  "use strict";

  var CFG = window.GAESTELISTE_CONFIG || {};
  var EVENT = CFG.EVENT || {};
  var MIN_AGE = Number(CFG.MIN_AGE) || 18;

  var form = document.getElementById("signup-form");
  if (!form) return;

  var signupSection = document.getElementById("signup");
  var successSection = document.getElementById("success");
  var successTitle = document.getElementById("success-title");
  var successText = document.getElementById("success-text");
  var statusBox = document.getElementById("form-status");
  var submitBtn = document.getElementById("submit-btn");
  var submitLabel = submitBtn.querySelector(".btn-label");
  var icsBtn = document.getElementById("ics-btn");

  var fields = {
    firstName: document.getElementById("firstName"),
    lastName: document.getElementById("lastName"),
    birthdate: document.getElementById("birthdate"),
    email: document.getElementById("email"),
    via: document.getElementById("via"),
    consent: document.getElementById("consent")
  };
  var newsletterEl = document.getElementById("newsletter");
  var honeypotEl = document.getElementById("website");

  var VIA_OPTIONS = ["sync.", "F32", "FourZed"];
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
  var NAME_MAX = 60;

  var submitting = false;
  var triedSubmit = false;
  var lastPayload = null;

  // Mindestalter im Hinweistext anzeigen
  Array.prototype.forEach.call(document.querySelectorAll("[data-min-age]"), function (el) {
    el.textContent = String(MIN_AGE);
  });

  // ---------------------------------------------------------------------
  // Datums-Helfer (ohne Zeitzonen, nur Jahr/Monat/Tag)
  // ---------------------------------------------------------------------

  function parseISODate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }

  function compareDates(a, b) {
    return (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
  }

  function ageOn(birth, ref) {
    var age = ref.y - birth.y;
    if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) age--;
    return age;
  }

  function today() {
    var n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }

  function toISO(o) {
    return o.y + "-" + pad(o.m) + "-" + pad(o.d);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var eventDate = parseISODate(EVENT.date) || today();

  // Spätestes erlaubtes Geburtsdatum als max-Attribut setzen
  (function setBirthdateMax() {
    var latest = { y: eventDate.y - MIN_AGE, m: eventDate.m, d: eventDate.d };
    // 29.02. in Nicht-Schaltjahren → 28.02.
    if (!parseISODate(toISO(latest))) latest.d = 28;
    fields.birthdate.max = toISO(latest);
  })();

  // ---------------------------------------------------------------------
  // Validierung
  // ---------------------------------------------------------------------

  function validateName(value, label) {
    var v = value.trim();
    if (!v) return "Bitte gib deinen " + label + " ein.";
    if (v.length > NAME_MAX) return "Der " + label + " darf höchstens " + NAME_MAX + " Zeichen lang sein.";
    if (/[\u0000-\u001F\u007F<>]/.test(v)) return "Der " + label + " enthält ungültige Zeichen.";
    return "";
  }

  var validators = {
    firstName: function () { return validateName(fields.firstName.value, "Vornamen"); },
    lastName: function () { return validateName(fields.lastName.value, "Nachnamen"); },
    birthdate: function () {
      var el = fields.birthdate;
      // Browser meldet unvollständige Eingabe über validity.badInput
      if (el.validity && el.validity.badInput) return "Bitte gib ein gültiges Datum ein.";
      if (!el.value) return "Bitte gib dein Geburtsdatum ein.";
      var b = parseISODate(el.value);
      if (!b) return "Bitte gib ein gültiges Datum ein.";
      if (b.y < 1900) return "Bitte überprüfe dein Geburtsdatum.";
      if (compareDates(b, today()) > 0) return "Das Geburtsdatum darf nicht in der Zukunft liegen.";
      if (ageOn(b, eventDate) < MIN_AGE) return "Du musst am Eventtag mindestens " + MIN_AGE + " Jahre alt sein.";
      return "";
    },
    email: function () {
      var v = fields.email.value.trim();
      if (!v) return "Bitte gib deine E-Mail-Adresse ein.";
      if (v.length > 254 || !EMAIL_RE.test(v)) return "Bitte gib eine gültige E-Mail-Adresse ein (z. B. name@beispiel.de).";
      return "";
    },
    via: function () {
      return VIA_OPTIONS.indexOf(fields.via.value) === -1 ? "Bitte wähle aus, über wen du kommst." : "";
    },
    consent: function () {
      return fields.consent.checked ? "" : "Bitte stimme der Speicherung deiner Daten zu, um dich anzumelden.";
    }
  };

  function setError(name, message) {
    var el = fields[name];
    var errEl = document.getElementById(name + "-error");
    if (message) {
      el.setAttribute("aria-invalid", "true");
      errEl.textContent = message;
    } else {
      el.removeAttribute("aria-invalid");
      errEl.textContent = "";
    }
  }

  function validateField(name) {
    var msg = validators[name]();
    setError(name, msg);
    return msg;
  }

  function validateAll() {
    var firstInvalid = null;
    Object.keys(fields).forEach(function (name) {
      if (validateField(name) && !firstInvalid) firstInvalid = fields[name];
    });
    return firstInvalid;
  }

  // Live-Validierung, sobald einmal abgeschickt wurde bzw. nach Verlassen des Feldes
  Object.keys(fields).forEach(function (name) {
    var el = fields[name];
    var evt = (el.type === "checkbox" || el.tagName === "SELECT") ? "change" : "input";
    el.addEventListener(evt, function () {
      if (triedSubmit || el.hasAttribute("aria-invalid")) validateField(name);
      if (name === "email") clearStatus();
    });
    el.addEventListener("blur", function () {
      if (el.type === "checkbox") return;
      if (el.value !== "" || triedSubmit) validateField(name);
    });
  });

  // ---------------------------------------------------------------------
  // Status- und Button-Zustand
  // ---------------------------------------------------------------------

  function showStatus(kind, title, text, withRetry) {
    statusBox.className = "notice notice--" + kind;
    statusBox.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = title;
    statusBox.appendChild(strong);
    if (text) {
      var p = document.createElement("p");
      p.textContent = text;
      statusBox.appendChild(p);
    }
    if (withRetry) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--secondary";
      btn.textContent = "Erneut versuchen";
      btn.addEventListener("click", function () {
        if (lastPayload) send(lastPayload);
      });
      statusBox.appendChild(btn);
    }
    statusBox.hidden = false;
  }

  function clearStatus() {
    statusBox.hidden = true;
    statusBox.innerHTML = "";
  }

  function setBusy(busy) {
    submitting = busy;
    submitBtn.disabled = busy;
    submitBtn.setAttribute("aria-busy", busy ? "true" : "false");
    submitLabel.textContent = busy ? "Wird gesendet …" : "Jetzt anmelden";
    var retry = statusBox.querySelector("button");
    if (retry) retry.disabled = busy;
  }

  // ---------------------------------------------------------------------
  // Absenden
  // ---------------------------------------------------------------------

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;
    triedSubmit = true;
    clearStatus();

    var firstInvalid = validateAll();
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    var payload = {
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      birthdate: fields.birthdate.value,
      email: fields.email.value.trim().toLowerCase(),
      via: fields.via.value,
      newsletter: !!newsletterEl.checked,
      consent: !!fields.consent.checked,
      website: honeypotEl.value
    };

    // Honeypot ausgefüllt → vermutlich Bot. Still "Erfolg" anzeigen, nichts senden.
    if (payload.website) {
      showSuccess(payload.firstName);
      return;
    }

    send(payload);
  });

  function send(payload) {
    if (submitting) return;
    lastPayload = payload;

    var url = String(CFG.WEB_APP_URL || "").trim();
    if (!/^https?:\/\//.test(url)) {
      showStatus("error", "Die Anmeldung ist noch nicht eingerichtet.",
        "Bitte versuche es später erneut oder wende dich an die Veranstalter.", false);
      return;
    }

    setBusy(true);

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, Number(CFG.REQUEST_TIMEOUT_MS) || 20000);

    fetch(url, {
      method: "POST",
      // text/plain ist ein "simple request" → kein CORS-Preflight
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      credentials: "omit",
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var data;
        try { data = JSON.parse(text); } catch (err) { throw new Error("Ungültige Antwort"); }
        handleResponse(data, payload);
      })
      .catch(function (err) {
        var timeout = err && err.name === "AbortError";
        showStatus("error",
          timeout ? "Der Server antwortet gerade nicht." : "Deine Anmeldung konnte nicht gesendet werden.",
          "Bitte prüfe deine Internetverbindung und versuche es erneut. Deine Eingaben bleiben erhalten.",
          true);
      })
      .then(function () {
        clearTimeout(timer);
        setBusy(false);
      });
  }

  function handleResponse(data, payload) {
    if (data && data.ok) {
      showSuccess(payload.firstName);
      return;
    }
    var code = data && data.code;
    if (code === "DUPLICATE") {
      setError("email", "Mit dieser E-Mail-Adresse bist du bereits angemeldet.");
      showStatus("info", "Du stehst bereits auf der Liste.",
        "Für diese E-Mail-Adresse gibt es schon eine Anmeldung. Du musst nichts weiter tun.", false);
      return;
    }
    if (code === "FULL") {
      showStatus("error", "Die Gästeliste ist leider voll.",
        "Es sind keine Plätze mehr frei. Danke für dein Interesse!", false);
      return;
    }
    if (code === "INVALID") {
      if (data.field && fields[data.field]) {
        setError(data.field, data.message || "Bitte überprüfe diese Angabe.");
        fields[data.field].focus();
      }
      showStatus("error", "Bitte überprüfe deine Angaben.", data.message || "", false);
      return;
    }
    if (code === "BUSY") {
      showStatus("error", "Gerade melden sich sehr viele gleichzeitig an.",
        "Bitte versuche es in ein paar Sekunden erneut.", true);
      return;
    }
    showStatus("error", "Beim Speichern ist ein Fehler aufgetreten.",
      "Bitte versuche es erneut. Deine Eingaben bleiben erhalten.", true);
  }

  function showSuccess(firstName) {
    successText.textContent = firstName
      ? "Danke, " + firstName + "! Wir freuen uns auf dich."
      : "Wir freuen uns auf dich.";
    clearStatus();
    signupSection.hidden = true;
    successSection.hidden = false;
    window.scrollTo(0, 0);
    successTitle.focus();
  }

  // ---------------------------------------------------------------------
  // Kalenderdatei (.ics)
  // ---------------------------------------------------------------------

  function icsEscape(s) {
    return String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  // Zeilen nach RFC 5545 auf max. 75 Oktette falten (UTF-8-sicher)
  function fold(line) {
    var out = [];
    var cur = "";
    var bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var code = line.charCodeAt(i);
      // Surrogatpaare zusammenhalten
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < line.length) { ch += line[++i]; }
      var len = unescape(encodeURIComponent(ch)).length;
      var limit = out.length === 0 ? 75 : 74;
      if (bytes + len > limit) {
        out.push(cur);
        cur = "";
        bytes = 0;
      }
      cur += ch;
      bytes += len;
    }
    out.push(cur);
    return out.join("\r\n ");
  }

  function icsLocal(date, time) {
    return date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
  }

  function utcStamp(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  }

  function buildICS() {
    var tz = EVENT.timezone || "Europe/Berlin";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gaesteliste//Community Pop-up//DE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Berlin",
      "BEGIN:DAYLIGHT",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "TZNAME:CEST",
      "DTSTART:19700329T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0100",
      "TZNAME:CET",
      "DTSTART:19701025T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:" + icsLocal(EVENT.date, EVENT.startTime) + "-community-popup@gaesteliste",
      "DTSTAMP:" + utcStamp(new Date()),
      "DTSTART;TZID=" + tz + ":" + icsLocal(EVENT.date, EVENT.startTime),
      "DTEND;TZID=" + tz + ":" + icsLocal(EVENT.date, EVENT.endTime),
      "SUMMARY:" + icsEscape(EVENT.title),
      "LOCATION:" + icsEscape(EVENT.location),
      "DESCRIPTION:" + icsEscape(EVENT.description),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  icsBtn.addEventListener("click", function () {
    var ics = buildICS();
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "community-popup-" + String(EVENT.date || "event") + ".ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  });

  // Für Tests im Browser erreichbar (keine Auswirkungen im Betrieb)
  window.__gaesteliste = { buildICS: buildICS, ageOn: ageOn, parseISODate: parseISODate };
})();
