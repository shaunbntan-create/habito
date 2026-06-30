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
    const name = user && user.name ? user.name : "Habito friend";
    $("#sc-profile").innerHTML = `
      <h2 class="scr-title">Profile</h2>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:10px 0 26px">
        <div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,var(--pink-soft),var(--blue-soft));display:grid;place-items:center;font-size:40px;box-shadow:var(--shadow-card)">🙂</div>
        <div style="font-family:var(--font-display);font-weight:600;font-size:20px">${esc(name)}</div>
        <div style="color:var(--ink-soft);font-size:13px">${esc(who)}</div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-lbl">Current streak</div><div class="stat-val">${st.current} days</div></div>
        <div class="stat-card"><div class="stat-lbl">Success rate</div><div class="stat-val">${st.success}%</div></div>
      </div>
      <button class="btn-ghost" id="profileReplay" style="width:100%;margin-bottom:10px">Replay tutorial</button>
      <button class="btn-ghost" id="profileSignOut" style="width:100%">Sign out</button>
      <p style="text-align:center;color:var(--ink-faint);font-size:12px;margin-top:20px">${Auth.hasKeys ? "Signed in with Supabase" : "Local demo mode"}</p>`;
    const rp = $("#profileReplay");
    if (rp) rp.addEventListener("click", () => openTutorial());
    const so = $("#profileSignOut");
    if (so) so.addEventListener("click", () => Auth.signOut());
  }

  /* ---------------- MOOD ---------------- */
  function renderMood() {
    const t = S.today();
    const todays = S.getMood(t);

    const chips = MOODS.map((m) =>
      `<button class="mood-chip ${todays && todays.key === m.key ? "sel" : ""}" data-mood="${m.key}" style="background:${cs(m.color)}">
         <span class="mc-face">${m.emoji}</span><span class="mc-lbl">${m.label}</span>
       </button>`).join("");

    // sleep
    const sleeps = S.recent("sleep", 10);
    const sleepBars = sleeps.map((d) => `<div class="mini-bar" style="height:${d.val ? Math.max(10, (d.val / 9) * 100) : 6}%"></div>`).join("");
    const lastSleep = [...sleeps].reverse().find((d) => d.val != null);
    const sh = lastSleep ? lastSleep.val : 0;
    const sleepVal = lastSleep ? `${Math.floor(sh)}h ${Math.round((sh - Math.floor(sh)) * 60)}min` : "—";

    // stress
    const sMap = { Low: 1, Mid: 2, High: 3 };
    const stresses = S.recent("stress", 10);
    const stressBars = stresses.map((d) => `<div class="mini-bar" style="height:${d.val ? (sMap[d.val] / 3) * 100 : 6}%"></div>`).join("");
    const lastStress = [...stresses].reverse().find((d) => d.val != null);
    const stressVal = lastStress ? lastStress.val : "—";

    // calendar (current month, Sunday-first to match the ref)
    const now = S.parse(t);
    const year = now.getFullYear(), month = now.getMonth();
    const startPad = new Date(year, month, 1).getDay();
    const dim = new Date(year, month + 1, 0).getDate();
    let cal = ["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span class="cal-h">${d}</span>`).join("");
    for (let i = 0; i < startPad; i++) cal += `<span class="cal-cell"></span>`;
    for (let d = 1; d <= dim; d++) {
      const iso = S.iso(new Date(year, month, d));
      const m = S.getMood(iso);
      const isToday = iso === t;
      cal += `<span class="cal-cell ${isToday ? "today" : ""}">${m
        ? `<span class="cal-face" style="background:${cs(moodOf(m.key).color)}">${moodOf(m.key).emoji}</span>`
        : `<span class="cal-num">${d}</span>`}</span>`;
    }

    // summary
    const sum = S.moodSummary(year, month);
    const descs = {
      happy: "You're riding a good wave. Bank it.",
      calm: "Steady and grounded. Keep the rhythm.",
      sleepy: "Running low on rest. Guard your sleep.",
      anxious: "A heavier stretch. Be kind to yourself.",
      sad: "Some low days. They pass, keep checking in.",
      angry: "Lots of friction lately. Name it, move it.",
    };
    let summaryHTML;
    if (!sum.count) {
      summaryHTML = `<div class="mood-summary">
        <div class="ms-top"><span class="ms-emoji">🌤️</span><span class="ms-title">How are you?</span></div>
        <div class="ms-desc">Tap a mood above to log your first check-in. Your month fills in from there.</div>
      </div>`;
    } else {
      const top = moodOf(sum.top) || moodOf("calm");
      summaryHTML = `<div class="mood-summary">
        <div class="ms-top"><span class="ms-emoji">${top.emoji}</span><span class="ms-title">${top.label}</span></div>
        <div class="ms-desc">${descs[top.key] || ""}</div>
        <div class="ms-stats">
          <div class="ms-stat"><b>${sum.count}</b><span>Check-ins</span></div>
          <div class="ms-stat"><b>${sum.tally.calm || 0}</b><span>Calm days</span></div>
          <div class="ms-stat"><b>${sum.tally.happy || 0}</b><span>Happy days</span></div>
        </div>
      </div>`;
    }

    $("#sc-mood").innerHTML = `
      <h2 class="scr-title">Mood</h2>
      <p class="mood-greeting">How are you<br/>feeling today?</p>
      <div class="mood-chips">${chips}</div>
      <div class="mood-stats">
        <div class="mstat sleep">
          <div class="mstat-lbl">Sleep duration</div>
          <div class="mstat-val">${sleepVal}</div>
          <div class="mini-bars">${sleepBars}</div>
        </div>
        <div class="mstat stress">
          <div class="mstat-lbl">Stress indicator</div>
          <div class="mstat-val">${stressVal}</div>
          <div class="mini-bars">${stressBars}</div>
        </div>
      </div>
      <div class="section-label">Mood calendar</div>
      <div class="mood-cal">${cal}</div>
      ${summaryHTML}`;
  }
  function getAudit() {
    try { const v = JSON.parse(localStorage.getItem(AUDIT_KEY)); if (v) return v; } catch (_) {}
    const o = {}; AUDIT_BUCKETS.forEach((b) => (o[b.id] = b.def)); return o;
  }
  const saveAudit = () => localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));

  function renderTime() {
    audit = audit || getAudit();
    const v = (id) => Number(audit[id]) || 0;
    const total = AUDIT_BUCKETS.reduce((s, b) => s + v(b.id), 0);
    const rem = 168 - total;
    const pct = Math.min(100, (total / 168) * 100);

    // 168-cell grid
    const cells = [];
    AUDIT_BUCKETS.forEach((b) => { for (let i = 0; i < v(b.id) && cells.length < 168; i++) cells.push(ACS[b.color]); });
    let grid = "";
    for (let i = 0; i < 168; i++) {
      grid += i < cells.length
        ? `<div class="aud-cell" style="background:${cells[i]}"></div>`
        : `<div class="aud-cell empty"></div>`;
    }

    const rows = AUDIT_BUCKETS.map((b) =>
      `<div class="aud-row">
         <span class="aud-sw" style="background:${ACS[b.color]}">${b.emoji}</span>
         <span class="aud-name">${b.label}</span>
         <span class="aud-step">
           <button data-aud="dec" data-id="${b.id}" aria-label="less ${b.label}">−</button>
           <span class="aud-val">${v(b.id)}</span>
           <button data-aud="inc" data-id="${b.id}" aria-label="more ${b.label}">+</button>
         </span>
       </div>`).join("");

    // the truth
    const ins = [];
    if (total > 168) ins.push(["⚠️", `You've allocated <b>${total}h</b>. A week only holds 168.`]);
    else if (rem >= 8) ins.push(["🕳️", `<b>${rem}h</b> unaccounted. That's where the week quietly leaks.`]);
    const spn = v("sleep") / 7;
    if (v("sleep") && spn < 7) ins.push(["😴", `That's <b>${spn.toFixed(1)}h</b> of sleep a night. Below 7 makes the rest cost more.`]);
    if (v("scroll") > v("learn")) ins.push(["📱", `You scroll <b>${v("scroll")}h</b> but learn <b>${v("learn")}h</b>. The feed is winning.`]);
    if (v("train") === 0) ins.push(["🏋️", `Zero training hours. The asset that compounds for 50 years got nothing.`]);
    if (v("work")) ins.push(["💻", `<b>${v("work")}h</b> of deep work. Protect it, that's the block that moves things.`]);
    const truth = ins.slice(0, 4).map(([d, h]) => `<div class="aud-ins"><span>${d}</span><span>${h}</span></div>`).join("");

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
      <div class="section-label" style="margin-top:22px">The truth</div>
      <div class="aud-truth">${truth}</div>`;
  }

  /* ---------------- onboarding tutorial ---------------- */
  const ONBOARD_KEY = "habito.onboarded.v1";
  const TUTORIAL = [
    { emoji: "👋", title: "Welcome to Habito", body: "Build the days you want, one square at a time. Quick 20-second tour." },
    { emoji: "🎯", title: "Today", body: "Your habits sit in a ring around a live daily score. Tap one to check it off for today." },
    { emoji: "🗓️", title: "Weekly", body: "Tap the Mon to Sun circles to mark each habit done. Every habit has its own colour." },
    { emoji: "🔥", title: "Overall", body: "Watch your streak, success rate and a contribution heatmap grow for every habit." },
    { emoji: "🌤️", title: "Mood", body: "Check in on how you feel, track sleep and stress, and fill in your mood calendar." },
    { emoji: "⏳", title: "The 168 Audit", body: "You get 168 hours a week. Pour them into buckets and see where they actually go." },
    { emoji: "➕", title: "Add your first habit", body: "Tap the pink + button any time to add a habit. That's it, you're set." },
  ];
  let tutStep = 0;
  const tutEl = () => document.getElementById("tutorial");
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
  function openTutorial() { tutStep = 0; tutEl().hidden = false; renderTutorial(); }
  function closeTutorial() { tutEl().hidden = true; try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (_) {} }
  function maybeTutorial() { let seen = false; try { seen = !!localStorage.getItem(ONBOARD_KEY); } catch (_) {} if (!seen) openTutorial(); }
  function wireTutorial() {
    tutEl().addEventListener("click", (e) => {
      const b = e.target.closest("[data-tut]"); if (!b) return;
      if (b.dataset.tut === "skip") return closeTutorial();
      if (tutStep === TUTORIAL.length - 1) closeTutorial();
      else { tutStep++; renderTutorial(); }
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
      if (m) { S.setMood(S.today(), { key: m.dataset.mood }); renderMood(); }
    });
  }

  function wireTime() {
    $("#sc-time").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-aud]");
      if (!btn) return;
      audit = audit || getAudit();
      const id = btn.dataset.id;
      const next = (Number(audit[id]) || 0) + (btn.dataset.aud === "inc" ? 1 : -1);
      audit[id] = Math.max(0, Math.min(168, next));
      saveAudit();
      renderTime();
    });
  }

  function init() { wireHabits(); wireMood(); wireTime(); wireModal(); wireTutorial(); }

  window.Screens = { init, go, openAdd, maybeTutorial, openTutorial, setUser: (u) => { user = u; } };
})();
