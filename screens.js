/* ============================================================
   Habito — screen rendering (Habits: Today / Weekly / Overall,
   plus Profile). Mood + Time render in the next pass.
   ============================================================ */
(function () {
  const S = window.Store;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const COLORS = ["pink", "blue", "green", "yellow", "purple", "peach"];
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

  // ---- 168 Audit ----
  const AUDIT_KEY = "habito.audit.v1";
  const AUDIT_BUCKETS = [
    { id: "sleep",  label: "Sleep",       emoji: "😴", color: "blue",   def: 49 },
    { id: "work",   label: "Deep work",   emoji: "💻", color: "purple", def: 45 },
    { id: "learn",  label: "Learning",    emoji: "📚", color: "green",  def: 7 },
    { id: "train",  label: "Training",    emoji: "🏋️", color: "coral",  def: 4 },
    { id: "eat",    label: "Eating",      emoji: "🍳", color: "yellow", def: 10 },
    { id: "social", label: "Social",      emoji: "👥", color: "pink",   def: 14 },
    { id: "scroll", label: "Scrolling",   emoji: "📱", color: "peach",  def: 14 },
    { id: "buffer", label: "Buffer",      emoji: "⚪", color: "gray",   def: 25 },
  ];
  const AC  = { blue: "#7dbaf6", purple: "#c7a4e8", green: "#8fd96a", coral: "#f77e72", yellow: "#fbcb4d", pink: "#f58bc0", peach: "#f9b58a", gray: "#bcb8b0" };
  const ACS = { blue: "#c6def9", purple: "#e2cef4", green: "#cdefb1", coral: "#f9bbb2", yellow: "#fae7a8", pink: "#f8c9e0", peach: "#f6d9c4", gray: "#e6e3dd" };
  // user-added activity buckets (id, label, emoji, color, custom)
  const AUDIT_CUST_KEY = "habito.auditCust.v1";
  const AUDIT_EMOJIS = ["✨", "🎨", "🎸", "📷", "🧹", "🚗", "🛒", "🐶", "📞", "🎮", "🧺", "🎧"];
  const AUDIT_COLORS = ["blue", "purple", "green", "coral", "yellow", "pink", "peach", "gray"];
  let customBuckets = null;

  let habitTab = "today";
  let user = null;
  let audit = null;

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
    const seg = (id, label) => `<button class="seg ${habitTab === id ? "active" : ""}" data-seg="${id}">${label}</button>`;
    let body = habitTab === "today" ? renderToday() : habitTab === "weekly" ? renderWeekly() : renderOverall();
    $("#sc-habits").innerHTML = `
      <h2 class="scr-title">Statistics</h2>
      <div class="segmented">${seg("today", "Today")}${seg("weekly", "Weekly")}${seg("overall", "Overall")}</div>
      ${body}`;
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
    const rows = S.weekMatrix(S.today());
    return rows.map(({ habit, days }) => {
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
          else if (c.done) bg = cs(h.color);
          else if (c.due) bg = "#eceae5";
          // emphasize done with full color
          if (c.done) bg = cv(h.color);
          return `<div class="heat-cell" style="background:${bg}"></div>`;
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
      <button class="btn-ghost" id="profileSignOut" style="width:100%">Sign out</button>`;
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
  }

  /* ---------------- MOOD ---------------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // daily check-in: simple yes/no questions that actually log today's
  // sleep / stress / mood, so the cards above are functional.
  const QUIZ = [
    { q: "Did you sleep well last night?", yes: { sleep: 8 }, no: { sleep: 5.5 } },
    { q: "Do you feel calm and in control today?", yes: { stress: "Low" }, no: { stress: "High" } },
    { q: "Have you moved your body today?", yes: { key: "happy" }, no: { key: "sleepy" } },
    { q: "Did you connect with someone you care about?", yes: { key: "calm" }, no: { key: "anxious" } },
  ];
  const quizKey = () => "habito.quiz." + S.today();
  const getQuizN = () => { try { return Number(localStorage.getItem(quizKey())) || 0; } catch (_) { return 0; } };
  const setQuizN = (n) => { try { localStorage.setItem(quizKey(), String(n)); } catch (_) {} };

  function renderMood() {
    const t = S.today();
    const todays = S.getMood(t);
    const nm = S.getName();
    const greetName = nm || "there";

    const chips = MOODS.map((m) =>
      `<button class="mood-chip ${todays && todays.key === m.key ? "sel" : ""}" data-mood="${m.key}">
         <span class="mc-face" style="background:${cs(m.color)}">${m.emoji}</span><span class="mc-lbl">${m.label}</span>
       </button>`).join("");

    // sleep (functional: from logged daily check-ins)
    const sleeps = S.recent("sleep", 12);
    const sleepBars = sleeps.map((d) => `<div class="mini-bar" style="height:${d.val ? Math.max(12, (d.val / 9) * 100) : 8}%"></div>`).join("");
    const lastSleep = [...sleeps].reverse().find((d) => d.val != null);
    const sh = lastSleep ? lastSleep.val : 0;
    const sleepVal = lastSleep ? `${Math.floor(sh)}h ${Math.round((sh - Math.floor(sh)) * 60)}min` : "—";

    // stress
    const sMap = { Low: 1, Mid: 2, High: 3 };
    const stresses = S.recent("stress", 12);
    const stressBars = stresses.map((d) => `<div class="mini-bar" style="height:${d.val ? (sMap[d.val] / 3) * 100 : 8}%"></div>`).join("");
    const lastStress = [...stresses].reverse().find((d) => d.val != null);
    const stressVal = lastStress ? lastStress.val : "—";

    // daily check-in quiz (drives the sleep/stress/mood above)
    const qn = getQuizN();
    let quizHTML;
    if (qn >= QUIZ.length) {
      quizHTML = `<div class="quiz-card">
        <div class="quiz-head"><span class="quiz-title">Daily check-in</span><span class="quiz-prog">Done ✓</span></div>
        <p class="quiz-q">All checked in for today. Your sleep, stress and mood above are up to date.</p>
      </div>`;
    } else {
      quizHTML = `<div class="quiz-card">
        <div class="quiz-head"><span class="quiz-title">Daily check-in</span><span class="quiz-prog">Question ${qn + 1}/${QUIZ.length}</span></div>
        <p class="quiz-q">${QUIZ[qn].q}</p>
        <div class="quiz-actions"><button class="quiz-btn" data-quiz="yes">Yes</button><button class="quiz-btn" data-quiz="no">No</button></div>
      </div>`;
    }

    // calendar (current month, Sunday-first to match the ref)
    const now = S.parse(t);
    const year = now.getFullYear(), month = now.getMonth();
    const startPad = new Date(year, month, 1).getDay();
    const dim = new Date(year, month + 1, 0).getDate();
    let cal = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<span class="cal-h">${d}</span>`).join("");
    for (let i = 0; i < startPad; i++) cal += `<span class="cal-cell"></span>`;
    for (let d = 1; d <= dim; d++) {
      const iso = S.iso(new Date(year, month, d));
      const m = S.getMood(iso);
      const isToday = iso === t;
      cal += `<span class="cal-cell ${isToday ? "today" : ""}">${m
        ? `<span class="cal-face" style="background:${cs(moodOf(m.key).color)}">${moodOf(m.key).emoji}</span>`
        : `<span class="cal-num">${d}</span>`}</span>`;
    }

    // monthly mood summary (the lower "calendar" screen)
    const sum = S.moodSummary(year, month);
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
        <div class="ms-top"><span class="ms-title">${top.label}</span><span class="ms-emoji">${top.emoji}</span></div>
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
      <div class="mood-date">${MONTHS[month]} ${now.getDate()}, ${year}</div>
      <p class="mood-greeting">Hello ${esc(greetName)}! How are<br/>you feeling today?</p>
      <div class="mood-chips">${chips}</div>
      <div class="mood-stats">
        <div class="mstat sleep">
          <div class="mstat-lbl">😴 Sleep duration</div>
          <div class="mini-bars">${sleepBars}</div>
          <div class="mstat-val">${sleepVal}</div>
        </div>
        <div class="mstat stress">
          <div class="mstat-lbl">😣 Stress indicator</div>
          <div class="mini-bars">${stressBars}</div>
          <div class="mstat-val">${stressVal}</div>
        </div>
      </div>
      ${quizHTML}
      <div class="section-label">Mood calendar</div>
      <div class="mood-cal">${cal}</div>
      ${summaryHTML}`;
  }
  function getAudit() {
    try { const v = JSON.parse(localStorage.getItem(AUDIT_KEY)); if (v) return v; } catch (_) {}
    const o = {}; AUDIT_BUCKETS.forEach((b) => (o[b.id] = b.def)); return o;
  }
  const saveAudit = () => localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));
  function getCustom() {
    if (customBuckets) return customBuckets;
    try { customBuckets = JSON.parse(localStorage.getItem(AUDIT_CUST_KEY)) || []; } catch (_) { customBuckets = []; }
    return customBuckets;
  }
  const saveCustom = () => { try { localStorage.setItem(AUDIT_CUST_KEY, JSON.stringify(customBuckets || [])); } catch (_) {} };
  const allBuckets = () => AUDIT_BUCKETS.concat(getCustom());

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
    audit = audit || getAudit();
    const buckets = allBuckets();
    const v = (id) => Number(audit[id]) || 0;
    const total = buckets.reduce((s, b) => s + v(b.id), 0);
    const rem = 168 - total;
    const pct = Math.min(100, (total / 168) * 100);

    // 168-cell grid
    const cells = [];
    buckets.forEach((b) => { for (let i = 0; i < v(b.id) && cells.length < 168; i++) cells.push(ACS[b.color] || ACS.gray); });
    let grid = "";
    for (let i = 0; i < 168; i++) {
      grid += i < cells.length
        ? `<div class="aud-cell" style="background:${cells[i]}"></div>`
        : `<div class="aud-cell empty"></div>`;
    }

    const rows = buckets.map((b) =>
      `<div class="aud-row">
         <span class="aud-sw" style="background:${ACS[b.color] || ACS.gray}">${b.emoji}</span>
         <span class="aud-name">${esc(b.label)}</span>
         <span class="aud-step">
           <button data-aud="dec" data-id="${b.id}" aria-label="less ${esc(b.label)}">−</button>
           <span class="aud-val">${v(b.id)}</span>
           <button data-aud="inc" data-id="${b.id}" aria-label="more ${esc(b.label)}">+</button>
           ${b.custom ? `<button class="aud-del" data-aud="del" data-id="${b.id}" aria-label="remove ${esc(b.label)}">×</button>` : ""}
         </span>
       </div>`).join("");

    const truth = buildTruth(v, total, rem).map(([d, h]) => `<div class="aud-ins"><span>${d}</span><span>${h}</span></div>`).join("");

    $("#sc-time").innerHTML = `
      <h2 class="scr-title">The 168 Audit</h2>
      <p class="aud-sub">You get 168 hours a week. Pour them into the buckets and see where they actually go.</p>
      <div class="aud-meter">
        <div class="aud-meter-head"><span class="aud-total">${total}<span class="aud-den">/168</span></span>
          <span class="aud-rem">${total > 168 ? (total - 168) + "h over" : rem === 0 ? "every hour placed" : rem + "h left"}</span></div>
        <div class="aud-bar"><div class="aud-fill" style="width:${pct}%;${total > 168 ? "background:var(--coral)" : ""}"></div></div>
      </div>
      <div class="aud-grid">${grid}</div>
      ${rows}
      <div class="aud-add">
        <input id="audNew" type="text" maxlength="22" placeholder="Add your own activity..." aria-label="New activity name" />
        <button class="aud-add-btn" data-aud="add">Add</button>
      </div>
      <div class="section-label" style="margin-top:22px">The truth</div>
      <div class="aud-truth">${truth}</div>`;
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
    { emoji: "➕", title: "You're all set", body: "Everything starts empty, this is your blank page. Tap the pink + button to add your very first habit whenever you're ready.", tab: "habits", seg: "today" },
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
  let nh = { emoji: "📖", color: "pink", freq: "Everyday" };
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
      const q = e.target.closest("[data-quiz]");
      if (q) {
        const qn = getQuizN(); if (qn >= QUIZ.length) return;
        S.setMood(S.today(), q.dataset.quiz === "yes" ? QUIZ[qn].yes : QUIZ[qn].no);
        setQuizN(qn + 1); return renderMood();
      }
      if (e.target.closest("[data-go-profile]")) {
        document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === "profile"));
        return go("profile");
      }
    });
  }

  function addActivity() {
    const inp = $("#audNew");
    const label = ((inp && inp.value) || "").trim();
    if (!label) { if (inp) inp.focus(); return; }
    const list = getCustom();
    const id = "c_" + Math.random().toString(36).slice(2, 8);
    list.push({ id, label, emoji: AUDIT_EMOJIS[list.length % AUDIT_EMOJIS.length], color: AUDIT_COLORS[list.length % AUDIT_COLORS.length], custom: true });
    saveCustom();
    audit = audit || getAudit();
    audit[id] = 0; saveAudit();
    renderTime();
  }
  function wireTime() {
    $("#sc-time").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-aud]");
      if (!btn) return;
      const act = btn.dataset.aud;
      audit = audit || getAudit();
      if (act === "add") return addActivity();
      const id = btn.dataset.id;
      if (act === "del") {
        customBuckets = getCustom().filter((b) => b.id !== id); saveCustom();
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
