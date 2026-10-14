(() => {
  "use strict";

  if (window.top !== window || document.getElementById("ema-planning-app")) return;

  const DAY_RE = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;
  const DATE_RE = /\b(\d{1,2})[\s/.\-]+(janv(?:ier)?|f[eé]vr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[eé]c(?:embre)?|\d{1,2})[\s/.\-]+(\d{2,4})\b/i;
  const RANGE_RE = /\b([01]?\d|2[0-3])\s*(?:h|:|\.)\s*([0-5]\d)?\s*(?:[-–—à]|\bau\b)\s*([01]?\d|2[0-3])\s*(?:h|:|\.)\s*([0-5]\d)?\b/i;
  const SINGLE_TIME_RE = /\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)\b/g;
  const COLORS = ["blue", "violet", "green", "orange", "pink", "cyan"];
  const CAMPUS_BASE = "https://campus2.mines-ales.fr";
  const CAMPUS_CATEGORIES = {
    "5.1": 556, "5.2": 557, "5.3": 558, "5.4": 559, "5.5": 560,
    "6.1": 561, "6.2": 562, "6.3": 563, "6.4": 564, "6.5": 565,
    "7.1": 554, "7.2": 555, "7.3b": 574, "7.4": 575, "7.6": 587,
    "8.1": 566, "8.2": 576, "8.3": 577, "8.5": 578, "8.6": 586,
    "9.1": 588, "9.2": 589, "9.3a": 590, "9.3b": 591, "9.4": 593, "9.5": 592
  };
  const CAMPUS_COURSES = globalThis.EMA_CAMPUS_COURSES || [];
  const originalTitle = document.title;

  function clean(value) {
    return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  }

  function minutes(hour, minute) {
    return Number(hour) * 60 + Number(minute || 0);
  }

  function readRange(line) {
    const match = line.match(RANGE_RE);
    if (match) {
      return { start: minutes(match[1], match[2]), end: minutes(match[3], match[4]), label: match[0] };
    }
    const times = [...line.matchAll(SINGLE_TIME_RE)];
    if (times.length >= 2) {
      return {
        start: minutes(times[0][1], times[0][2]),
        end: minutes(times[1][1], times[1][2]),
        label: `${times[0][0]} – ${times[1][0]}`
      };
    }
    return null;
  }

  function dayLabel(line) {
    const day = line.match(DAY_RE)?.[1];
    const date = line.match(DATE_RE)?.[0];
    if (!day && !date) return null;
    return clean([day, date].filter(Boolean).join(" "));
  }

  function sourceLines() {
    const raw = document.body.innerText || "";
    return raw.split(/\r?\n/).map(clean).filter(Boolean).filter((line) => line.length < 400);
  }

  function emptyWeekMessage() {
    const text = clean(document.body.innerText || "");
    return text.match(/Aucun\s+cours\s+pour\s+la\s+semaine\s+du\s+\d{1,2}\/\d{1,2}\/\d{4}\s+au\s+\d{1,2}\/\d{1,2}\/\d{4}/i)?.[0] || null;
  }

  function isLoginPage() {
    return Boolean(
      document.querySelector('form[action*="/login/"] input[type="password"]') ||
      document.querySelector('form.form-signin input[name="Username"] + label, form.form-signin input[name="Password"]')
    );
  }

  // Lecture prioritaire de la structure réellement utilisée par le site EMA.
  function parseEmaDom() {
    const days = [];
    let currentDay = null;

    // Les jours peuvent être imbriqués dans des conteneurs différents selon
    // que le site affiche un jour ou une semaine complète.
    for (const element of document.querySelectorAll("h2, .row.mb-3")) {
      if (element.matches("h2") && DAY_RE.test(element.textContent)) {
        currentDay = { label: clean(element.textContent), events: [] };
        days.push(currentDay);
        continue;
      }

      if (!currentDay || !element.matches(".row.mb-3")) continue;
      const courseButton = element.querySelector('button[onclick*="Ressource"]');
      const candidates = [...element.querySelectorAll("span")];
      const timeElement = candidates.find((span) => readRange(clean(span.textContent)));
      if (!courseButton || !timeElement) continue;

      const timeText = clean(timeElement.textContent);
      const range = readRange(timeText);
      if (!range || range.end <= range.start) continue;

      const teacher = clean(element.querySelector('a[href^="mailto:"]')?.textContent || "");
      const groupAndRoom = clean(timeText.replace(RANGE_RE, "").replace(/^[-–—\s]+/, ""));
      const notes = candidates
        .filter((span) => span !== timeElement)
        .map((span) => clean(span.textContent))
        .filter(Boolean);

      currentDay.events.push({
        start: range.start,
        end: range.end,
        time: range.label,
        details: [clean(courseButton.textContent), groupAndRoom, teacher, ...notes].filter(Boolean),
        sourceButton: courseButton
      });
    }

    return days.filter((day) => day.events.length).slice(0, 7);
  }

  function parsePlanning(lines) {
    const days = [];
    let currentDay = null;
    let currentEvent = null;

    const ensureDay = (label = "Planning") => {
      if (!currentDay) {
        currentDay = { label, events: [] };
        days.push(currentDay);
      }
      return currentDay;
    };

    for (const line of lines) {
      const label = dayLabel(line);
      const range = readRange(line);

      if (label && !range) {
        currentDay = { label, events: [] };
        days.push(currentDay);
        currentEvent = null;
        continue;
      }

      if (range && range.end > range.start && range.end - range.start <= 24 * 60) {
        const day = ensureDay();
        currentEvent = {
          start: range.start,
          end: range.end,
          time: range.label,
          details: [clean(line.replace(range.label, ""))].filter(Boolean)
        };
        day.events.push(currentEvent);
        continue;
      }

      if (currentEvent && !/^(semaine|planning|pr[eé]c[eé]dent|suivant|imprimer|accueil)$/i.test(line)) {
        if (!currentEvent.details.includes(line) && currentEvent.details.length < 5) currentEvent.details.push(line);
      }
    }

    const useful = days.filter((day) => day.events.length);
    const unique = [];
    const seen = new Set();
    for (const day of useful) {
      day.events = day.events.filter((event) => {
        const key = `${day.label}|${event.start}|${event.end}|${event.details.join("|")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (day.events.length) unique.push(day);
    }
    return unique.slice(0, 7);
  }

  function formatTime(value) {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  }

  function eventColor(event, fallbackIndex) {
    const courseNumber = event.details.join(" ").match(/\b\d+(?:\.\d+)+\b/)?.[0];
    if (!courseNumber) return COLORS[fallbackIndex % COLORS.length];

    // Une même référence de cours produit toujours le même index de couleur.
    let hash = 0;
    for (const character of courseNumber) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    return COLORS[hash % COLORS.length];
  }

  function normalizedCourseText(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function campusUrlFor(event) {
    const text = normalizedCourseText(event.details.join(" "));
    const rawCode = text.match(/\b[5-9]\.\d+(?:\.(?:\d+|[ab]))?\b/)?.[0];
    const code = rawCode?.replace(/\.(?=[ab]$)/, "");
    const rootCode = code?.match(/^\d+\.\d+[ab]?/)?.[0];
    const candidates = rootCode ? CAMPUS_COURSES.filter((course) => course.code === rootCode) : CAMPUS_COURSES;
    const eventTokens = new Set(text.split(" ").filter((token) => token.length > 2));
    let bestCourse = null;
    let bestScore = 0;

    for (const course of candidates) {
      const titleTokens = normalizedCourseText(course.title).split(" ").filter((token) => token.length > 2);
      const matchedTokens = titleTokens.filter((token) => eventTokens.has(token)).length;
      const score = titleTokens.length ? matchedTokens / titleTokens.length : 0;
      if (score > bestScore) {
        bestCourse = course;
        bestScore = score;
      }
    }

    if (bestCourse && bestScore >= 0.34) {
      return `${CAMPUS_BASE}/course/view.php?id=${bestCourse.id}`;
    }

    const coursePosition = Number(rawCode?.match(/\.(\d+)$/)?.[1]);
    if (coursePosition >= 1 && candidates[coursePosition - 1]) {
      return `${CAMPUS_BASE}/course/view.php?id=${candidates[coursePosition - 1].id}`;
    }

    if (candidates.length === 1) {
      return `${CAMPUS_BASE}/course/view.php?id=${candidates[0].id}`;
    }

    if (code) {
      const categoryCode = CAMPUS_CATEGORIES[code] ? code : code.split(".").slice(0, 2).join(".");
      if (CAMPUS_CATEGORIES[categoryCode]) {
        return `${CAMPUS_BASE}/course/index.php?categoryid=${CAMPUS_CATEGORIES[categoryCode]}`;
      }
    }
    return null;
  }

  function collectNavigation() {
    return [...document.querySelectorAll("button, a")]
      .map((element) => {
        const rawLabel = clean(element.textContent);
        const action = element.getAttribute("onclick") || "";
        const isNavigation = /Change(?:Day|Week|Mode)/i.test(action) || /^(?:jour|semaine).*?(?:dent|suivant)|^affichage\s+(?:jour|semaine)$/i.test(rawLabel);
        if (!isNavigation) return null;

        let label = rawLabel;
        if (/ChangeMode/i.test(action)) label = /semaine/i.test(rawLabel) ? "Affichage semaine" : "Affichage jour";
        else if (/suivant/i.test(rawLabel)) label = `${/semaine/i.test(rawLabel) ? "Semaine" : "Jour"} suivant${/semaine/i.test(rawLabel) ? "e" : ""}`;
        else if (/dent/i.test(rawLabel)) label = `${/semaine/i.test(rawLabel) ? "Semaine" : "Jour"} précédent${/semaine/i.test(rawLabel) ? "e" : ""}`;
        return { element, label };
      })
      .filter(Boolean);
  }

  function planningContext() {
    const route = new URL(window.location.href).searchParams.get("url") || "";
    const match = route.match(/^(eleve|promo)\/(\d+)\/(?:week\/)?(\d{4})(\d{2})(\d{2})/i);
    if (!match) return null;
    return {
      planningType: match[1].toLowerCase(),
      planningId: match[2],
      date: new Date(Number(match[3]), Number(match[4]) - 1, Number(match[5]))
    };
  }

  function undatedPlanningContext() {
    const route = new URL(window.location.href).searchParams.get("url") || "";
    const match = route.match(/^(eleve|promo)\/(\d+)(?:\/week)?\/?$/i);
    return match ? { planningType: match[1].toLowerCase(), planningId: match[2] } : null;
  }

  function isoWeekYear(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() + 4 - (copy.getDay() || 7));
    return copy.getFullYear();
  }

  function mondayOf(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
    return copy;
  }

  function firstIsoMonday(year) {
    return mondayOf(new Date(year, 0, 4));
  }

  function mondayOfIsoWeek(year, week) {
    const monday = firstIsoMonday(year);
    monday.setDate(monday.getDate() + (week - 1) * 7);
    return monday;
  }

  function isoWeekNumber(date) {
    const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    thursday.setDate(thursday.getDate() + 4 - (thursday.getDay() || 7));
    const firstThursday = new Date(thursday.getFullYear(), 0, 4);
    return 1 + Math.round((mondayOf(thursday) - mondayOf(firstThursday)) / 604800000);
  }

  function dateKey(date) {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  }

  function shortDate(date) {
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "");
  }

  function weekPickerHtml(context) {
    if (!context) return "";
    const currentIsoYear = isoWeekYear(context.date);
    const currentWeek = isoWeekNumber(context.date);
    const schoolYear = currentWeek >= 36 ? currentIsoYear : currentIsoYear - 1;
    const selectedMonday = dateKey(mondayOf(context.date));
    const start = mondayOfIsoWeek(schoolYear, 36);
    const nextSchoolYearStart = mondayOfIsoWeek(schoolYear + 1, 36);
    const options = [];

    for (let monday = new Date(start); monday < nextSchoolYearStart; monday.setDate(monday.getDate() + 7)) {
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const key = dateKey(monday);
      const week = isoWeekNumber(monday);
      options.push(`<option value="${key}"${key === selectedMonday ? " selected" : ""}>Semaine ${week} · ${shortDate(monday)} – ${shortDate(sunday)}</option>`);
    }

    return `<div class="ema-week-picker">
      <label for="ema-week-select">Aller directement à</label>
      <select id="ema-week-select" aria-label="Choisir une semaine">${options.join("")}</select>
      <div class="ema-year-buttons">
        <button type="button" class="ema-year-button" data-school-year="${schoolYear - 1}">${schoolYear - 1}–${schoolYear}</button>
        <strong>${schoolYear}–${schoolYear + 1}</strong>
        <button type="button" class="ema-year-button" data-school-year="${schoolYear + 1}">${schoolYear + 1}–${schoolYear + 2}</button>
      </div>
    </div>`;
  }

  function render(days, noCourseMessage = null) {
    const navigation = collectNavigation();
    const context = planningContext();
    const allEvents = days.flatMap((day) => day.events);
    const minEvent = allEvents.length ? Math.min(...allEvents.map((event) => event.start)) : 8 * 60;
    const maxEvent = allEvents.length ? Math.max(...allEvents.map((event) => event.end)) : 18 * 60;
    const start = Math.max(0, Math.floor(minEvent / 60) * 60);
    const end = Math.min(24 * 60, Math.ceil(maxEvent / 60) * 60);
    const span = Math.max(60, end - start);
    const hourHeight = 72;
    const bodyHeight = (span / 60) * hourHeight;
    const bottomPadding = 30;
    const calendarBodyHeight = bodyHeight + bottomPadding;
    const app = document.createElement("div");
    app.id = "ema-planning-app";

    const columns = days.map((day, dayIndex) => {
      const events = day.events.map((event, eventIndex) => {
        const top = ((event.start - start) / span) * bodyHeight;
        const height = Math.max(34, ((event.end - event.start) / span) * bodyHeight - 4);
        const details = event.details.filter(Boolean);
        const title = details[0] || "Cours";
        const meta = details.slice(1).join(" · ");
        const color = eventColor(event, dayIndex + eventIndex);
        const campusUrl = campusUrlFor(event);
        const campusClass = campusUrl ? " ema-campus-linked" : "";
        const tooltip = `${details.join(" — ")}${campusUrl ? " — Ouvrir dans Campus" : ""}`;
        return `<article class="ema-event ema-${color}${campusClass}" data-day="${dayIndex}" data-event="${eventIndex}" style="top:${top}px;height:${height}px" title="${escapeHtml(tooltip)}">
          <strong>${escapeHtml(title)}</strong>
          <time>${formatTime(event.start)} – ${formatTime(event.end)}</time>
          ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
          ${campusUrl ? `<small class="ema-campus-hint">Campus ↗</small>` : ""}
        </article>`;
      }).join("");
      return `<section class="ema-day"><header>${escapeHtml(day.label)}</header><div class="ema-day-body" style="height:${calendarBodyHeight}px">${events}</div></section>`;
    }).join("");

    const hours = [];
    for (let value = start; value <= end; value += 60) {
      hours.push(`<span style="top:${((value - start) / span) * bodyHeight}px">${formatTime(value)}</span>`);
    }

    const navigationButtons = navigation.map(({ label }, index) => {
      const direction = /précédent/i.test(label) ? " ema-nav-previous" : /suivant/i.test(label) ? " ema-nav-next" : " ema-nav-mode";
      return `<button class="ema-nav-button${direction}" data-navigation="${index}" type="button">${escapeHtml(label)}</button>`;
    }).join("");

    app.innerHTML = `<div class="ema-shell">
      <div class="ema-toolbar">
        <div class="ema-heading"><h1>Mon planning</h1><p>${allEvents.length} cours détecté${allEvents.length > 1 ? "s" : ""}</p></div>
        <div class="ema-actions">
          <a class="ema-selection-link" href="https://webdfd.mines-ales.fr/planning-eleves/">← Changer de planning</a>
          ${navigationButtons ? `<nav class="ema-nav" aria-label="Navigation du planning">${navigationButtons}</nav>` : ""}
          <button id="ema-toggle" class="ema-original-button" type="button">Voir le planning original</button>
        </div>
      </div>
      ${weekPickerHtml(context)}
      ${days.length ? `<div class="ema-calendar"><aside class="ema-hours" style="height:${calendarBodyHeight}px">${hours.join("")}</aside><main>${columns}</main></div>` : `<div class="ema-empty"><h2>${noCourseMessage ? "Aucun cours cette semaine" : "Aucun horaire détecté"}</h2><p>${escapeHtml(noCourseMessage || "Le format de cette page n’a pas encore été reconnu.")}</p><button id="ema-original" type="button">Afficher la page originale</button></div>`}
    </div>`;

    document.body.appendChild(app);
    document.body.classList.add("ema-enhanced");
    document.title = `Mon planning — ${originalTitle}`;

    const toggle = () => {
      const original = document.body.classList.toggle("ema-show-original");
      const button = document.getElementById("ema-toggle");
      if (button) button.textContent = original ? "Voir le planning en blocs" : "Voir le planning original";
    };
    document.getElementById("ema-toggle")?.addEventListener("click", toggle);
    document.getElementById("ema-original")?.addEventListener("click", toggle);
    app.querySelectorAll("[data-navigation]").forEach((button) => {
      button.addEventListener("click", () => navigation[Number(button.dataset.navigation)]?.element.click());
    });
    const goToWeek = (mondayKey) => {
      if (!context) return;
      const destination = new URL(window.location.href);
      destination.searchParams.set("url", `${context.planningType}/${context.planningId}/week/${mondayKey}`);
      window.location.assign(destination.href);
    };
    document.getElementById("ema-week-select")?.addEventListener("change", (event) => goToWeek(event.target.value));
    app.querySelectorAll("[data-school-year]").forEach((button) => {
      button.addEventListener("click", () => goToWeek(dateKey(mondayOfIsoWeek(Number(button.dataset.schoolYear), 36))));
    });
    app.querySelectorAll(".ema-event").forEach((card) => {
      const event = days[Number(card.dataset.day)]?.events[Number(card.dataset.event)];
      if (!event) return;
      const campusUrl = campusUrlFor(event);
      if (!campusUrl && !event.sourceButton) return;
      card.classList.add("ema-clickable");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      const openResource = () => {
        if (campusUrl) {
          const campusTab = window.open(campusUrl, "_blank", "noopener,noreferrer");
          if (campusTab) campusTab.opener = null;
        } else {
          event.sourceButton.click();
        }
      };
      card.addEventListener("click", openResource);
      card.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") openResource();
      });
    });
    window.requestAnimationFrame(() => {
      app.querySelectorAll(".ema-event").forEach((card) => {
        card.classList.toggle("ema-overflowing", card.scrollHeight > card.clientHeight + 1);
      });
    });
  }

  const undatedContext = undatedPlanningContext();
  if (!isLoginPage() && undatedContext) {
    const destination = new URL(window.location.href);
    destination.searchParams.set(
      "url",
      `${undatedContext.planningType}/${undatedContext.planningId}/week/${dateKey(mondayOf(new Date()))}`
    );
    window.location.replace(destination.href);
    return;
  }

  let refreshTimer = null;
  let observer = null;
  let renderedSignature = "";

  function refreshPlanning() {
    if (isLoginPage() || !planningContext()) {
      document.getElementById("ema-planning-app")?.remove();
      document.body.classList.remove("ema-enhanced", "ema-show-original");
      return;
    }

    const exactPlanning = parseEmaDom();
    const days = exactPlanning.length ? exactPlanning : parsePlanning(sourceLines());
    const noCourseMessage = emptyWeekMessage();
    const signature = days.length
      ? days.map((day) => `${day.label}:${day.events.map((event) => `${event.start}-${event.end}-${event.details[0] || ""}`).join(",")}`).join("|")
      : `empty:${noCourseMessage || ""}`;
    if ((!days.length && !noCourseMessage) || signature === renderedSignature) return;

    renderedSignature = signature;
    observer?.disconnect();
    const showedOriginal = document.body.classList.contains("ema-show-original");
    document.getElementById("ema-planning-app")?.remove();
    document.body.classList.remove("ema-enhanced", "ema-show-original");
    render(days, noCourseMessage);
    if (showedOriginal) {
      document.body.classList.add("ema-show-original");
      const toggleButton = document.getElementById("ema-toggle");
      if (toggleButton) toggleButton.textContent = "Voir le planning en blocs";
    }
    observer?.observe(document.body, { childList: true, subtree: true });
  }

  // Le site peut ajouter certains jours après DOMContentLoaded. On attend un
  // court instant puis on reconstruit automatiquement la grille à chaque ajout.
  if (planningContext()) {
    observer = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshPlanning, 180);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    refreshTimer = window.setTimeout(refreshPlanning, 180);
  }
})();
