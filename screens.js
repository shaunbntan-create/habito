/* ============================================================
   Habito — screen rendering (Habits: Today / Weekly / Overall,
   plus Profile). Mood + Time render in the next pass.
   ============================================================ */
(function () {
  const S = window.Store;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const COLORS = ["pink", "blue", "green", "yellow", "purple", "peach", "coral"];
  const cv = (k) => `var(--${COLORS.includes(k) ? k : "pink"})`;
  const cs = (k) => `var(--${COLORS.includes(k) ? k : "pink"}-soft)`;
  const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

  const MOODS = [
    { key: "happy",   label: "Happy",   emoji: "😄", color: "green" },
    { key: "calm",    label: "Calm",    emoji: "🙂", color: "blue" },
    { key: "sleepy",  label: "Sleepy",  emoji: "😴", color: "yellow" },
    { key: "anxious", label: "Anxious", emoji: "😰", color: "peach" },
    { key: "sad",     label: "Sad",     emoji: "😢", color: "purple" },
    { key: "angry",   label: "Angry",   emoji: "😠", color: "coral" },
  ];
  const moodOf = (k) => MOODS.find((m) => m.key === k);

  // hand-drawn SVG faces (flat, line style) to match the reference look,
  // instead of OS emoji glyphs. Features only; the colored square is the bg.
  const FACE = {
    happy:   `<circle cx="37" cy="44" r="5" fill="#211c18"/><circle cx="63" cy="44" r="5" fill="#211c18"/><path d="M33 56 q17 18 34 0" stroke="#211c18" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    calm:    `<circle cx="37" cy="47" r="4.6" fill="#211c18"/><circle cx="63" cy="47" r="4.6" fill="#211c18"/><path d="M40 60 q10 7 20 0" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/>`,
    sleepy:  `<path d="M30 46 q7 5 14 0" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M56 46 q7 5 14 0" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="63" rx="6" ry="7" fill="none" stroke="#211c18" stroke-width="4"/>`,
    anxious: `<path d="M31 40 q8 -4 14 1" stroke="#211c18" stroke-width="4.4" fill="none" stroke-linecap="round"/><path d="M55 41 q6 -5 14 -1" stroke="#211c18" stroke-width="4.4" fill="none" stroke-linecap="round"/><circle cx="38" cy="51" r="4.4" fill="#211c18"/><circle cx="62" cy="51" r="4.4" fill="#211c18"/><path d="M41 64 q9 -5 18 0" stroke="#211c18" stroke-width="4.4" fill="none" stroke-linecap="round"/>`,
    sad:     `<circle cx="37" cy="47" r="4.6" fill="#211c18"/><circle cx="63" cy="47" r="4.6" fill="#211c18"/><path d="M41 65 q9 -7 18 0" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/>`,
    angry:   `<path d="M30 43 l15 4" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M70 43 l-15 4" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/><circle cx="38" cy="53" r="4.4" fill="#211c18"/><circle cx="62" cy="53" r="4.4" fill="#211c18"/><path d="M41 65 q9 -6 18 0" stroke="#211c18" stroke-width="4.6" fill="none" stroke-linecap="round"/>`,
  };
  const faceSVG = (k) => `<svg class="face-svg" viewBox="22 26 56 56" aria-hidden="true">${FACE[k] || FACE.calm}</svg>`;
  const ICON_SLEEP = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M20.5 14.3A8 8 0 1 1 9.7 3.5 6.4 6.4 0 0 0 20.5 14.3z" fill="currentColor"/></svg>`;
  const ICON_STRESS = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M3 12h3.5l2-6 3.5 12 2.5-7 1.5 3H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // ---- 168 Audit ----
  const AUDIT_KEY = "habito.audit.v2";
  const AUDIT_LIST_KEY = "habito.auditList.v1";
  // seed list (fully editable: add / remove / change emoji, all at runtime)
  const AUDIT_DEFAULTS = [
    { id: "sleep",  label: "Sleep",     emoji: "😴", color: "blue" },
    { id: "work",   label: "Deep work", emoji: "💻", color: "purple" },
    { id: "learn",  label: "Learning",  emoji: "📚", color: "green" },
    { id: "train",  label: "Training",  emoji: "🏋️", color: "coral" },
    { id: "eat",    label: "Eating",    emoji: "🍳", color: "yellow" },
    { id: "social", label: "Social",    emoji: "👥", color: "pink" },
    { id: "scroll", label: "Scrolling", emoji: "📱", color: "peach" },
    { id: "buffer", label: "Buffer",    emoji: "⚪", color: "gray" },
  ];
  const AC  = { blue: "#7dbaf6", purple: "#c7a4e8", green: "#8fd96a", coral: "#f77e72", yellow: "#fbcb4d", pink: "#f58bc0", peach: "#f9b58a", gray: "#bcb8b0" };
  const ACS = { blue: "#c6def9", purple: "#e2cef4", green: "#cdefb1", coral: "#f9bbb2", yellow: "#fae7a8", pink: "#f8c9e0", peach: "#f6d9c4", gray: "#e6e3dd" };
  const AUDIT_EMOJIS = ["😴", "💻", "📚", "🏋️", "🍳", "👥", "📱", "🧘", "🏃", "🎨", "🎸", "📷", "🚗", "🛒", "🐶", "📞", "🎮", "🎧", "🧹", "💼", "☕", "🌙"];
  const AUDIT_COLORS = ["blue", "purple", "green", "coral", "yellow", "pink", "peach", "gray"];
  let buckets = null;
  let emojiEditId = null; // id of the activity whose emoji picker is open

  let habitTab = "today";
  let user = null;
  let audit = null;
  let weekAnchor = null; // anchor date for the Weekly view (lets you edit past weeks)
  let calAnchor = null;  // month shown in the mood calendar (lets you edit past months)
  let calPick = null;    // iso of the calendar day being edited
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOWN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const prettyDate = (i) => { const d = S.parse(i); return `${DOWN[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
  const fmtRange = (startISO, endISO) => {
    const a = S.parse(startISO), b = S.parse(endISO);
    const f = (d) => MON[d.getMonth()] + " " + d.getDate();
    return f(a) + " - " + f(b);
  };

  const check = (color) =>
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* ---------------- HABITS: header + active subview ---------------- */
  const addBtn = (label) => `<button class="pill-btn" data-add><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>${label}</button>`;

  function renderHabits() {
    if (!S.getHabits().length) {
      $("#sc-habits").innerHTML = `
        <h2 class="scr-title">Habits</h2>
        <div class="empty">
          <div class="empty-emoji">🌱</div>
          <div class="empty-title">No habits yet</div>
          <div class="empty-body">Add the first habit you want to build. Small and daily beats big and never.</div>
          ${addBtn("Add your first habit")}
        </div>`;
      return;
    }
    const sc = $("#sc-habits") ? $("#sc-habits").scrollTop : 0;
    const seg = (id, label) => `<button class="seg ${habitTab === id ? "active" : ""}" data-seg="${id}">${label}</button>`;
    let body = habitTab === "today" ? renderToday() : habitTab === "weekly" ? renderWeekly() : renderOverall();
    $("#sc-habits").innerHTML = `
      <h2 class="scr-title">Statistics</h2>
      <div class="segmented">${seg("today", "Today")}${seg("weekly", "Weekly")}${seg("overall", "Overall")}</div>
      ${body}`;
    $("#sc-habits").scrollTop = sc;
  }

  /* ---------------- TODAY ---------------- */
  function renderToday() {
    const habits = S.getHabits();
    const t = S.today();
    const score = S.dayScore(t);
    const prog = S.dayProgress(t);
    const N = habits.length;
    const R = 37; // ring radius in %
    const blobs = habits.map((h, i) => {
      const ang = (-90 + i * (360 / N)) * (Math.PI / 180);
      const x = 50 + R * Math.cos(ang);
      const y = 50 + R * Math.sin(ang);
      const done = S.isDone(h.id, t);
      return `<button class="ring-blob" data-toggle="${h.id}" data-iso="${t}"
        style="left:${x}%;top:${y}%;background:${cs(h.color)};opacity:${done ? 1 : 0.5}"
        title="${esc(h.name)}">${h.emoji}</button>`;
    }).join("");

    // yesterday comparison
    const y = S.addDays(t, -1);
    const sy = S.dayScore(y);
    let alert = "";
    if (sy > 0) {
      const delta = Math.round(((score - sy) / sy) * 100);
      if (delta < 0) {
        alert = `<div class="alert-card"><p>Your habits score dropped <span class="pct">${Math.abs(delta)}%</span> compared to yesterday.</p><button class="alert-mini" data-discuss>Let's discuss</button></div>`;
      } else if (delta > 0) {
        alert = `<div class="alert-card up"><p>Your habits score is up <span class="pct">${delta}%</span> from yesterday. Keep the streak alive.</p><button class="alert-mini" data-discuss>See how</button></div>`;
      }
    }

    // summary bars: last 7 days
    let bars = "";
    for (let i = 6; i >= 0; i--) {
      const d = S.addDays(t, -i);
      const sc = S.dayScore(d);
      const col = COLORS[(6 - i) % COLORS.length];
      const lbl = DAYS[S.dow(d)];
      bars += `<div class="bar-col"><div class="bar" style="height:${Math.max(6, sc * 10)}%;background:${cs(col)}"></div><span class="bar-lbl">${lbl}</span></div>`;
    }

    return `
      <div class="ring-wrap">
        <button class="edit-btn" data-go="weekly" aria-label="Edit habits">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18 10l-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 6l4 4" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        ${blobs}
        <div class="ring-center">
          <div class="ring-score">${score.toFixed(1)}</div>
          <div class="ring-sub">${prog.done >= prog.due ? "<b>All habits done</b> today 🎉" : `Your <b>daily habits</b> are not completed.`}</div>
        </div>
      </div>
      <div class="today-actions">
        <button class="pill-btn" data-add><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>Add habit</button>
        <button class="icon-btn" data-export aria-label="Export"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="icon-btn" data-share aria-label="Share"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M12 16V4m0 0L8 8m4-4l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      ${alert}
      <div class="section-label">Summary</div>
      <div class="bars">${bars}</div>`;
  }

  /* ---------------- WEEKLY ---------------- */
  function renderWeekly() {
    const anchor = weekAnchor || S.today();
    const start = S.startOfWeek(anchor);
    const end = S.addDays(start, 6);
    const atCurrent = end >= S.today();
    const nav = `<div class="week-nav">
      <button class="wn-btn" data-week="-1" aria-label="Previous week">‹</button>
      <span class="wn-range">${fmtRange(start, end)}</span>
      <button class="wn-btn" data-week="1" aria-label="Next week" ${atCurrent ? "disabled" : ""}>›</button>
    </div>`;
    const rows = S.weekMatrix(anchor);
    const cards = rows.map(({ habit, days }) => {
      const dots = days.map((d, i) =>
        `<div class="day-cell">
           <span class="day-lbl">${DAYS[i]}</span>
           <button class="day-dot ${d.due ? (d.done ? "done" : "") : "off"}" ${d.due ? `data-toggle="${habit.id}" data-iso="${d.iso}"` : "disabled"}
             style="${d.done ? `background:${cs(habit.color)}` : ""}">${check(cv(habit.color))}</button>
         </div>`).join("");
      return `<div class="habit-card">
        <div class="habit-top">
          <span class="habit-ic" style="background:${cs(habit.color)}">${habit.emoji}</span>
          <span class="habit-name">${esc(habit.name)}</span>
          <span class="habit-freq">${esc(habit.freq)}</span>
        </div>
        <div class="week-grid">${dots}</div>
      </div>`;
    }).join("");
    return nav + cards;
  }

  /* ---------------- OVERALL ---------------- */
  function renderOverall() {
    const st = S.stats();
    const cards = [
      ["Current streak", `${st.current} days`],
      ["Success rate", `${st.success}%`],
      ["Best streak day", `${st.best} days`],
      ["Completed habits", `${st.completed}`],
    ].map(([l, v]) => `<div class="stat-card"><div class="stat-lbl">${l}</div><div class="stat-val">${v}</div></div>`).join("");

    const heats = S.getHabits().map((h) => {
      const rows = S.heatmap(h.id, 18);
      const lines = rows.map((row) => {
        const cells = row.map((c) => {
          let bg = "#f1efeb";
          if (c.future) bg = "transparent";
          else if (c.done) bg = cv(h.color);
          else if (c.due) bg = "#eceae5";
          const tap = !c.future && c.due ? ` data-toggle="${h.id}" data-iso="${c.iso}"` : "";
          return `<div class="heat-cell${tap ? " tap" : ""}" style="background:${bg}"${tap}></div>`;
        }).join("");
        return `<div class="heat-line">${cells}</div>`;
      }).join("");
      const labels = ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="heat-row-lbl">${d}</span>`).join("");
      return `<div class="heat-card">
        <div class="habit-top">
          <span class="habit-ic" style="background:${cs(h.color)}">${h.emoji}</span>
          <span class="habit-name">${esc(h.name)}</span>
          <span class="habit-freq">${esc(h.freq)}</span>
        </div>
        <div class="heat-grid"><div class="heat-rows">${labels}</div><div class="heat-cols">${lines}</div></div>
      </div>`;
    }).join("");

    return `<div class="section-label">Summary</div><div class="stat-grid">${cards}</div>${heats}`;
  }

  /* ---------------- PROFILE ---------------- */
  function renderProfile() {
    const st = S.stats();
    const who = user && user.email ? user.email : "you";
    const name = S.getName();
    $("#sc-profile").innerHTML = `
      <h2 class="scr-title">Profile</h2>
      <div class="profile-head">
        <div class="profile-avatar">🙂</div>
        <input id="profileName" class="profile-name-input" type="text" maxlength="40"
          placeholder="Add your name" value="${esc(name)}" aria-label="Your name" />
        <div class="profile-email">${esc(who)}</div>
      </div>
      <div class="stat-grid">${[
        ["Current streak", `${st.current} days`],
        ["Success rate", `${st.success}%`],
        ["Best streak", `${st.best} days`],
        ["Completions", `${st.completed}`],
        ["Habits", `${S.getHabits().length}`],
        ["Mood check-ins", `${S.moodTotal()}`],
      ].map(([l, val]) => `<div class="stat-card"><div class="stat-lbl">${l}</div><div class="stat-val">${val}</div></div>`).join("")}</div>
      <button class="btn-ghost" id="profileReplay" style="width:100%;margin-bottom:10px">Replay tutorial</button>
      <button class="btn-ghost" id="profileSignOut" style="width:100%;margin-bottom:10px">Sign out</button>
      <button class="btn-ghost danger" id="profileReset" style="width:100%">Reset all data</button>
      <div class="reset-confirm" id="resetConfirm" hidden>
        <p>Are you sure you want to reset everything to zero? This clears all your habits, moods and time data.</p>
        <div class="reset-actions">
          <button class="btn-ghost" id="resetCancel">Cancel</button>
          <button class="btn-danger" id="resetYes">Yes, reset</button>
        </div>
      </div>`;
    const nm = $("#profileName");
    if (nm) {
      const save = () => S.setName(nm.value);
      nm.addEventListener("change", save);
      nm.addEventListener("blur", save);
      nm.addEventListener("keydown", (e) => { if (e.key === "Enter") nm.blur(); });
    }
    const rp = $("#profileReplay");
    if (rp) rp.addEventListener("click", () => openTutorial());
    const so = $("#profileSignOut");
    if (so) so.addEventListener("click", () => Auth.signOut());
    const rs = $("#profileReset"), rc = $("#resetConfirm");
    if (rs) rs.addEventListener("click", () => { rs.hidden = true; if (rc) rc.hidden = false; });
    const rcc = $("#resetCancel");
    if (rcc) rcc.addEventListener("click", () => { if (rc) rc.hidden = true; if (rs) rs.hidden = false; });
    const ry = $("#resetYes");
    if (ry) ry.addEventListener("click", () => resetData());
  }

  async function resetData() {
    try {
      localStorage.removeItem(AUDIT_KEY);
      localStorage.removeItem(AUDIT_LIST_KEY);
      Object.keys(localStorage).forEach((k) => { if (k.indexOf("habito.quiz.") === 0) localStorage.removeItem(k); });
    } catch (_) {}
    audit = null; buckets = null; emojiEditId = null; weekAnchor = null; habitTab = "today";
    if (S.resetAll) { try { await S.resetAll(); } catch (_) {} }
    if (S.load) { try { await S.load(user); } catch (_) {} }
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === "habits"));
    go("habits");
  }

  /* ---------------- MOOD ---------------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function renderMood() {
    const sc = $("#sc-mood") ? $("#sc-mood").scrollTop : 0;
    const t = S.today();
    const todays = S.getMood(t);
    const nm = S.getName();
    const greetName = nm || "there";

    const chips = MOODS.map((m) =>
      `<button class="mood-chip ${todays && todays.key === m.key ? "sel" : ""}" data-mood="${m.key}">
         <span class="mc-face" style="background:${cs(m.color)}">${faceSVG(m.key)}</span><span class="mc-lbl">${m.label}</span>
       </button>`).join("");

    // sleep + stress are 0-100 "how I felt" scores, set via the check-in sliders
    const sleepScore = todays && typeof todays.sleep === "number" ? todays.sleep : null;
    const stressScore = todays && typeof todays.stress === "number" ? todays.stress : null;

    const sleeps = S.recent("sleep", 12);
    const sleepBars = sleeps.map((d) => `<div class="mini-bar" style="height:${d.val != null ? Math.max(8, d.val) : 8}%"></div>`).join("");
    const lastSleep = [...sleeps].reverse().find((d) => d.val != null);
    const sleepVal = lastSleep ? `${Math.round(lastSleep.val)}/100` : "—";

    const stresses = S.recent("stress", 12);
    const stressBars = stresses.map((d) => `<div class="mini-bar" style="height:${d.val != null ? Math.max(8, d.val) : 8}%"></div>`).join("");
    const lastStress = [...stresses].reverse().find((d) => d.val != null);
    const stressVal = lastStress ? `${Math.round(lastStress.val)}/100` : "—";

    // daily check-in: rate sleep + stress out of 100 via sliders
    const sv = sleepScore != null ? sleepScore : 50;
    const tv = stressScore != null ? stressScore : 50;
    const quizHTML = `<div class="quiz-card">
      <div class="quiz-head"><span class="quiz-title">Daily check-in</span></div>
      <div class="checkin-row">
        <div class="checkin-label"><span>😴 How well did you sleep?</span><span class="checkin-val">${sv}</span></div>
        <input type="range" min="0" max="100" value="${sv}" class="checkin-slider" data-checkin="sleep" aria-label="Sleep score out of 100" />
      </div>
      <div class="checkin-row">
        <div class="checkin-label"><span>😣 How stressed do you feel?</span><span class="checkin-val">${tv}</span></div>
        <input type="range" min="0" max="100" value="${tv}" class="checkin-slider" data-checkin="stress" aria-label="Stress score out of 100" />
      </div>
    </div>`;

    // calendar — navigable month, tap any day to set/edit its mood
    const now = S.parse(t);
    const calBase = S.parse(calAnchor || t);
    const cy = calBase.getFullYear(), cm = calBase.getMonth();
    const startPad = new Date(cy, cm, 1).getDay();
    const dim = new Date(cy, cm + 1, 0).getDate();
    const isThisMonth = cy === now.getFullYear() && cm === now.getMonth();
    let cal = DOWN.map((d) => `<span class="cal-h">${d}</span>`).join("");
    for (let i = 0; i < startPad; i++) cal += `<span class="cal-cell pad"></span>`;
    for (let d = 1; d <= dim; d++) {
      const iso = S.iso(new Date(cy, cm, d));
      const m = S.getMood(iso);
      const isToday = iso === t;
      const future = iso > t;
      cal += `<button class="cal-cell ${isToday ? "today" : ""} ${calPick === iso ? "picking" : ""}" ${future ? "disabled" : `data-day="${iso}"`}>${m && m.key
        ? `<span class="cal-face" style="background:${cs(moodOf(m.key).color)}">${faceSVG(m.key)}</span>`
        : `<span class="cal-num">${d}</span>`}</button>`;
    }
    const calNav = `<div class="cal-nav">
      <button class="wn-btn" data-cal="-1" aria-label="Previous month">‹</button>
      <span class="wn-range">${MON[cm]} ${cy}</span>
      <button class="wn-btn" data-cal="1" aria-label="Next month" ${isThisMonth ? "disabled" : ""}>›</button>
    </div>`;
    let pickHTML = "";
    if (calPick) {
      const pm = S.getMood(calPick);
      pickHTML = `<div class="cal-pick">
        <div class="cal-pick-date">${prettyDate(calPick)}</div>
        <div class="cal-pick-faces">
          ${MOODS.map((mm) => `<button class="cal-pf ${pm && pm.key === mm.key ? "sel" : ""}" data-setday="${calPick}" data-key="${mm.key}" style="background:${cs(mm.color)}">${faceSVG(mm.key)}</button>`).join("")}
          ${pm && pm.key ? `<button class="cal-pf clear" data-setday="${calPick}" data-key="" aria-label="Clear">✕</button>` : ""}
        </div>
      </div>`;
    }

    // monthly mood summary (reflects the month being viewed)
    const sum = S.moodSummary(cy, cm);
    const descs = {
      happy: "You're feeling upbeat and optimistic. Keep up the good vibes.",
      calm: "Steady, calm and grounded. Keep the rhythm going.",
      sleepy: "Running a little low on rest. Guard your sleep.",
      anxious: "A heavier stretch lately. Be kind to yourself.",
      sad: "Some low days in the mix. They pass, keep checking in.",
      angry: "Lots of friction lately. Name it, then move it.",
    };
    const msStats = (c, calm, happy) => `<div class="ms-stats">
      <div class="ms-stat"><span class="ms-k">Check-ins</span><b>${c}</b><span class="ms-u">this month</span></div>
      <div class="ms-stat"><span class="ms-k">Calm</span><b>${calm}</b><span class="ms-u">days</span></div>
      <div class="ms-stat"><span class="ms-k">Happy</span><b>${happy}</b><span class="ms-u">days</span></div>
    </div>`;
    let summaryHTML;
    if (!sum.count) {
      summaryHTML = `<div class="mood-summary">
        <div class="ms-label">Monthly mood summary</div>
        <div class="ms-top"><span class="ms-title">How are you?</span><span class="ms-emoji">🌤️</span></div>
        <div class="ms-desc">Tap a mood above to log your first check-in. Your month fills in from there.</div>
        ${msStats(0, 0, 0)}
      </div>`;
    } else {
      const top = moodOf(sum.top) || moodOf("calm");
      summaryHTML = `<div class="mood-summary">
        <div class="ms-label">Monthly mood summary</div>
        <div class="ms-top"><span class="ms-title">${top.label}</span><span class="ms-face" style="background:${cs(top.color)}">${faceSVG(top.key)}</span></div>
        <div class="ms-desc">${descs[top.key] || ""}</div>
        ${msStats(sum.count, sum.tally.calm || 0, sum.tally.happy || 0)}
      </div>`;
    }

    $("#sc-mood").innerHTML = `
      <div class="mood-header">
        <div class="mh-avatar">🙂</div>
        <div class="mh-text"><div class="mh-hello">Welcome back</div><div class="mh-name">${esc(nm || "friend")}</div></div>
        <button class="mh-btn" data-go-profile aria-label="Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.5" stroke="currentColor" stroke-width="2"/><path d="M5.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="mood-date">${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}</div>
      <p class="mood-greeting">Hello ${esc(greetName)}! How are<br/>you feeling today?</p>
      <div class="mood-chips">${chips}</div>
      <div class="mood-stats">
        <div class="mstat sleep">
          <div class="mstat-lbl"><span class="mstat-ic">${ICON_SLEEP}</span>Sleep score</div>
          <div class="mini-bars">${sleepBars}</div>
          <div class="mstat-val">${sleepVal}</div>
        </div>
        <div class="mstat stress">
          <div class="mstat-lbl"><span class="mstat-ic">${ICON_STRESS}</span>Stress score</div>
          <div class="mini-bars">${stressBars}</div>
          <div class="mstat-val">${stressVal}</div>
        </div>
      </div>
      ${quizHTML}
      <div class="section-label">Mood calendar</div>
      ${calNav}
      <div class="mood-cal">${cal}</div>
      ${pickHTML}
      ${summaryHTML}`;
    $("#sc-mood").scrollTop = sc;
  }
  function getAudit() {
    try { const v = JSON.parse(localStorage.getItem(AUDIT_KEY)); if (v) return v; } catch (_) {}
    return {}; // everything starts at zero
  }
  const saveAudit = () => localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));
  function getBuckets() {
    if (buckets) return buckets;
    try { buckets = JSON.parse(localStorage.getItem(AUDIT_LIST_KEY)); } catch (_) {}
    if (!Array.isArray(buckets) || !buckets.length) buckets = AUDIT_DEFAULTS.map((b) => ({ id: b.id, label: b.label, emoji: b.emoji, color: b.color }));
    return buckets;
  }
  const saveBuckets = () => { try { localStorage.setItem(AUDIT_LIST_KEY, JSON.stringify(buckets || [])); } catch (_) {} };

  // "The truth" — build every insight that is currently TRUE, then rotate the
  // window day to day so different real observations surface over time.
  function buildTruth(v, total, rem) {
    const all = [];
    if (total > 168) all.push(["⚠️", `You've allocated <b>${total}h</b>. A week only holds 168.`]);
    else if (rem >= 8) all.push(["🕳️", `<b>${rem}h</b> unaccounted. That's where the week quietly leaks.`]);
    else if (rem > 0) all.push(["✅", `Only <b>${rem}h</b> left to place. The week is almost fully mapped.`]);
    const spn = v("sleep") / 7;
    if (v("sleep") && spn < 7) all.push(["😴", `That's <b>${spn.toFixed(1)}h</b> of sleep a night. Below 7 makes the rest cost more.`]);
    else if (spn >= 7.5) all.push(["🌙", `<b>${spn.toFixed(1)}h</b> of sleep a night. That's the foundation everything else stands on.`]);
    if (v("scroll") && v("scroll") > v("learn")) all.push(["📱", `You scroll <b>${v("scroll")}h</b> but learn <b>${v("learn")}h</b>. The feed is winning.`]);
    if (v("scroll") >= 14) all.push(["⏳", `<b>${v("scroll")}h</b> scrolling a week is about <b>${Math.round((v("scroll") * 52) / 24)}</b> full days a year.`]);
    if (v("train") === 0) all.push(["🏋️", `Zero training hours. The asset that compounds for 50 years got nothing.`]);
    else if (v("train") >= 3) all.push(["💪", `<b>${v("train")}h</b> training. The one asset that pays off for decades is getting fed.`]);
    if (v("work")) all.push(["💻", `<b>${v("work")}h</b> of deep work. Protect it, that's the block that moves things.`]);
    if (v("learn") >= 7) all.push(["📚", `<b>${v("learn")}h</b> learning. Small and weekly is how skills quietly compound.`]);
    if (v("social") === 0) all.push(["👥", `No social hours booked. Relationships are a habit too, schedule one.`]);
    if (v("eat") && v("eat") < 7) all.push(["🍳", `Only <b>${v("eat")}h</b> for eating all week. Fuel is not the place to cut corners.`]);
    if (all.length <= 4) return all;
    const d = new Date();
    const off = (d.getDate() + d.getDay()) % all.length;
    const out = [];
    for (let i = 0; i < 4; i++) out.push(all[(off + i) % all.length]);
    return out;
  }

  function renderTime() {
    const sc = $("#sc-time") ? $("#sc-time").scrollTop : 0;
    audit = audit || getAudit();
    const list = getBuckets();
    const v = (id) => Number(audit[id]) || 0;
    const total = list.reduce((s, b) => s + v(b.id), 0);
    const rem = 168 - total;

    // breakdown bar: one colored segment per activity, remainder = empty track
    const segs = list.filter((b) => v(b.id) > 0).map((b) =>
      `<div class="aud-seg" style="width:${Math.min(100, (v(b.id) / 168) * 100)}%;background:${AC[b.color] || AC.gray}" title="${esc(b.label)} ${v(b.id)}h"></div>`).join("");

    // every activity: tap the icon to change its emoji, × to remove it
    const rows = list.map((b) =>
      `<div class="aud-row">
         <button class="aud-sw" data-emoji="${b.id}" style="background:${ACS[b.color] || ACS.gray}" aria-label="Change ${esc(b.label)} icon">${b.emoji}</button>
         <span class="aud-name">${esc(b.label)}</span>
         <span class="aud-step">
           <button data-aud="dec" data-id="${b.id}" aria-label="less ${esc(b.label)}">−</button>
           <span class="aud-val">${v(b.id)}</span>
           <button data-aud="inc" data-id="${b.id}" aria-label="more ${esc(b.label)}">+</button>
           <button class="aud-del" data-aud="del" data-id="${b.id}" aria-label="remove ${esc(b.label)}">×</button>
         </span>
       </div>
       ${emojiEditId === b.id ? `<div class="aud-emoji-pick">${AUDIT_EMOJIS.map((e) => `<button class="aud-ep" data-set-emoji="${b.id}" data-val="${e}">${e}</button>`).join("")}</div>` : ""}`).join("");

    const truth = buildTruth(v, total, rem).map(([d, h]) => `<div class="aud-ins"><span>${d}</span><span>${h}</span></div>`).join("");

    $("#sc-time").innerHTML = `
      <h2 class="scr-title">The 168 Audit</h2>
      <p class="aud-sub">You get 168 hours a week. Pour them into the buckets and see where they actually go.</p>
      <div class="aud-meter">
        <div class="aud-meter-head"><span class="aud-total">${total}<span class="aud-den">/168</span></span>
          <span class="aud-rem">${total > 168 ? (total - 168) + "h over" : rem === 0 ? "every hour placed" : rem + "h left"}</span></div>
        <div class="aud-stack">${segs}</div>
      </div>
      ${rows}
      <div class="aud-add">
        <input id="audNew" type="text" maxlength="22" placeholder="Add your own activity..." aria-label="New activity name" />
        <button class="aud-add-btn" data-aud="add">Add</button>
      </div>
      <div class="section-label" style="margin-top:22px">The truth</div>
      <div class="aud-truth">${truth}</div>`;
    $("#sc-time").scrollTop = sc;
  }

  /* ---------------- onboarding tutorial ---------------- */
  const ONBOARD_KEY = "habito.onboarded.v1";
  // Each step drives the real app to a section (tab + optional habits subview)
  // so the tour walks through the live screens one by one.
  const TUTORIAL = [
    { emoji: "👋", title: "Welcome to Habito", body: "A tiny home for your habits, your mood and your week. Here's a quick guided tour, tap Next to walk through each part one by one.", tab: "habits", seg: "today" },
    { emoji: "🎯", title: "1. Today", body: "Your day at a glance. Each habit is a bubble around the ring, and the big number in the middle is your live score out of 10. Tap a bubble to check that habit off for today.", tab: "habits", seg: "today" },
    { emoji: "🗓️", title: "2. Weekly", body: "Every habit gets a row of seven circles, Monday to Sunday. Tap a circle to mark a day done, so you can see your whole week at a glance.", tab: "habits", seg: "weekly" },
    { emoji: "🔥", title: "3. Overall", body: "Your long game lives here. Current streak, success rate, and a colour heatmap for each habit that fills in the more you show up.", tab: "habits", seg: "overall" },
    { emoji: "🌤️", title: "4. Mood", body: "Check in on how you feel each day, log your sleep and stress, and watch your mood calendar fill in across the month.", tab: "mood" },
    { emoji: "⏳", title: "5. The 168 Audit", body: "You get 168 hours a week. Pour them into buckets like sleep, work and training, then read the honest truth about where your time really goes.", tab: "time" },
    { emoji: "🙂", title: "6. Profile", body: "Add your name so the app feels like yours, see your headline stats, and replay this tour any time.", tab: "profile" },
    { emoji: "➕", title: "You're all set", body: "Everything starts empty, this is your blank page. Use the Add habit button on the Today screen to create your first one whenever you're ready.", tab: "habits", seg: "today" },
  ];
  let tutStep = 0;
  const tutEl = () => document.getElementById("tutorial");
  // drive the live app to the section this step is describing
  function applyStep() {
    const s = TUTORIAL[tutStep];
    if (!s.tab) return;
    if (s.seg) habitTab = s.seg;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === s.tab));
    go(s.tab);
  }
  function renderTutorial() {
    const s = TUTORIAL[tutStep];
    const last = tutStep === TUTORIAL.length - 1;
    const dots = TUTORIAL.map((_, i) => `<span class="tut-dot ${i === tutStep ? "on" : ""}"></span>`).join("");
    tutEl().innerHTML = `
      <div class="tut-scrim"></div>
      <div class="tut-card">
        <div class="tut-emoji">${s.emoji}</div>
        <div class="tut-title">${s.title}</div>
        <div class="tut-body">${s.body}</div>
        <div class="tut-dots">${dots}</div>
        <div class="tut-actions">
          <button class="tut-skip" data-tut="skip">Skip</button>
          <button class="tut-next" data-tut="next">${last ? "Get started" : "Next"}</button>
        </div>
      </div>`;
  }
  function openTutorial() { tutStep = 0; tutEl().hidden = false; applyStep(); renderTutorial(); }
  function closeTutorial() {
    tutEl().hidden = true;
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (_) {}
    habitTab = "today";
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === "habits"));
    go("habits");
  }
  function maybeTutorial() { let seen = false; try { seen = !!localStorage.getItem(ONBOARD_KEY); } catch (_) {} if (!seen) openTutorial(); }
  function wireTutorial() {
    tutEl().addEventListener("click", (e) => {
      const b = e.target.closest("[data-tut]"); if (!b) return;
      if (b.dataset.tut === "skip") return closeTutorial();
      if (tutStep === TUTORIAL.length - 1) return closeTutorial();
      tutStep++; applyStep(); renderTutorial();
    });
  }

  /* ---------------- add-habit modal ---------------- */
  let nh = { emoji: "📖", color: "pink", freq: "Every day" };
  function buildSwatches() {
    const wrap = $("#nhColor"); if (!wrap) return;
    wrap.innerHTML = COLORS.map((c, i) =>
      `<button type="button" class="swatch ${i === 0 ? "sel" : ""}" data-color="${c}" style="background:${cv(c)}"></button>`).join("");
    nh.color = COLORS[0];
  }
  function openAdd() { $("#addHabitModal").hidden = false; $("#nhName").value = ""; $("#nhName").focus(); }
  function closeAdd() { $("#addHabitModal").hidden = true; }
  function wireModal() {
    buildSwatches();
    const m = $("#addHabitModal");
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return closeAdd();
      const em = e.target.closest(".emoji-pick");
      if (em) { $("#nhEmoji").querySelectorAll(".emoji-pick").forEach((x) => x.classList.remove("sel")); em.classList.add("sel"); nh.emoji = em.textContent; return; }
      const sw = e.target.closest(".swatch");
      if (sw) { $("#nhColor").querySelectorAll(".swatch").forEach((x) => x.classList.remove("sel")); sw.classList.add("sel"); nh.color = sw.dataset.color; return; }
      const ch = e.target.closest(".chip");
      if (ch) { $("#nhFreq").querySelectorAll(".chip").forEach((x) => x.classList.remove("sel")); ch.classList.add("sel"); nh.freq = ch.textContent.trim(); return; }
    });
    $("#nhSave").addEventListener("click", () => {
      const name = $("#nhName").value.trim();
      if (!name) { $("#nhName").focus(); return; }
      S.addHabit({ name, emoji: nh.emoji, color: nh.color, freq: nh.freq });
      closeAdd();
      habitTab = "weekly";
      go("habits");
    });
  }

  /* ---------------- interactions on habits screen ---------------- */
  function wireHabits() {
    $("#sc-habits").addEventListener("click", (e) => {
      const seg = e.target.closest("[data-seg]");
      if (seg) { habitTab = seg.dataset.seg; renderHabits(); return; }
      const wk = e.target.closest("[data-week]");
      if (wk && !wk.disabled) { weekAnchor = S.addDays(weekAnchor || S.today(), Number(wk.dataset.week) * 7); renderHabits(); return; }
      const tg = e.target.closest("[data-toggle]");
      if (tg) { S.toggle(tg.dataset.toggle, tg.dataset.iso); renderHabits(); return; }
      const goEl = e.target.closest("[data-go]");
      if (goEl) { habitTab = goEl.dataset.go; renderHabits(); return; }
      if (e.target.closest("[data-add]")) return openAdd();
      if (e.target.closest("[data-export]")) return exportData();
      if (e.target.closest("[data-share]")) return shareApp();
      const dis = e.target.closest("[data-discuss]");
      if (dis) { dis.outerHTML = `<p style="font-size:13.5px;color:var(--ink-soft);margin-top:2px">Tip: pick the one habit that pulls the others up, and protect it first.</p>`; return; }
    });
  }

  function exportData() {
    const data = { habits: S.getHabits(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "habito-export.json"; a.click();
    URL.revokeObjectURL(a.href);
  }
  async function shareApp() {
    const url = location.href.split("#")[0];
    try { if (navigator.share) { await navigator.share({ title: "Habito", text: "Building better days with Habito", url }); return; } } catch (_) {}
    try { await navigator.clipboard.writeText(url); } catch (_) {}
  }

  /* ---------------- router ---------------- */
  function go(tab) {
    ["habits", "mood", "time", "profile"].forEach((t) => { $("#sc-" + t).hidden = t !== tab; });
    if (tab === "habits") renderHabits();
    else if (tab === "mood") renderMood();
    else if (tab === "time") renderTime();
    else if (tab === "profile") renderProfile();
  }

  function wireMood() {
    $("#sc-mood").addEventListener("click", (e) => {
      const m = e.target.closest("[data-mood]");
      if (m) { S.setMood(S.today(), { key: m.dataset.mood }); return renderMood(); }
      // calendar month navigation
      const cn = e.target.closest("[data-cal]");
      if (cn && !cn.disabled) {
        const base = S.parse(calAnchor || S.today());
        calAnchor = S.iso(new Date(base.getFullYear(), base.getMonth() + Number(cn.dataset.cal), 1));
        calPick = null; return renderMood();
      }
      // tap a day to open its mood picker
      const day = e.target.closest("[data-day]");
      if (day) { calPick = calPick === day.dataset.day ? null : day.dataset.day; return renderMood(); }
      // pick (or clear) a mood for the chosen day
      const sd = e.target.closest("[data-setday]");
      if (sd) {
        const iso = sd.dataset.setday;
        if (sd.dataset.key) S.setMood(iso, { key: sd.dataset.key }); else S.clearMood(iso);
        calPick = null; return renderMood();
      }
      if (e.target.closest("[data-go-profile]")) {
        document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === "profile"));
        return go("profile");
      }
    });
    // check-in sliders: live number while dragging, commit + refresh on release
    $("#sc-mood").addEventListener("input", (e) => {
      const sl = e.target.closest("[data-checkin]");
      if (!sl) return;
      const row = sl.closest(".checkin-row");
      const lbl = row && row.querySelector(".checkin-val");
      if (lbl) lbl.textContent = sl.value;
    });
    $("#sc-mood").addEventListener("change", (e) => {
      const sl = e.target.closest("[data-checkin]");
      if (!sl) return;
      S.setMood(S.today(), sl.dataset.checkin === "sleep" ? { sleep: Number(sl.value) } : { stress: Number(sl.value) });
      renderMood();
    });
  }

  function addActivity() {
    const inp = $("#audNew");
    const label = ((inp && inp.value) || "").trim();
    if (!label) { if (inp) inp.focus(); return; }
    const list = getBuckets();
    const id = "c_" + Math.random().toString(36).slice(2, 8);
    list.push({ id, label, emoji: AUDIT_EMOJIS[list.length % AUDIT_EMOJIS.length], color: AUDIT_COLORS[list.length % AUDIT_COLORS.length] });
    saveBuckets();
    audit = audit || getAudit();
    audit[id] = 0; saveAudit();
    emojiEditId = id; // open the icon picker so they can set its emoji right away
    renderTime();
  }
  function wireTime() {
    $("#sc-time").addEventListener("click", (e) => {
      audit = audit || getAudit();
      // change an activity's emoji
      const ep = e.target.closest("[data-set-emoji]");
      if (ep) {
        const b = getBuckets().find((x) => x.id === ep.dataset.setEmoji);
        if (b) { b.emoji = ep.dataset.val; saveBuckets(); }
        emojiEditId = null; renderTime(); return;
      }
      const em = e.target.closest("[data-emoji]");
      if (em) { emojiEditId = emojiEditId === em.dataset.emoji ? null : em.dataset.emoji; renderTime(); return; }
      const btn = e.target.closest("[data-aud]");
      if (!btn) return;
      const act = btn.dataset.aud;
      if (act === "add") return addActivity();
      const id = btn.dataset.id;
      if (act === "del") {
        buckets = getBuckets().filter((b) => b.id !== id); saveBuckets();
        delete audit[id]; saveAudit(); renderTime(); return;
      }
      const next = (Number(audit[id]) || 0) + (act === "inc" ? 1 : -1);
      audit[id] = Math.max(0, Math.min(168, next));
      saveAudit();
      renderTime();
    });
    $("#sc-time").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target && e.target.id === "audNew") { e.preventDefault(); addActivity(); }
    });
  }

  function init() { wireHabits(); wireMood(); wireTime(); wireModal(); wireTutorial(); }

  window.Screens = { init, go, openAdd, maybeTutorial, openTutorial, setUser: (u) => { user = u; } };
})();
