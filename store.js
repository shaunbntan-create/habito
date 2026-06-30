/* ============================================================
   Habito — data store (habits + moods)
   Cloud-backed via Supabase when signed in (per-user, RLS),
   localStorage for demo mode + as an offline cache.
   Dates are ISO "YYYY-MM-DD". Week starts Monday.
   ============================================================ */
(function () {
  const HKEY = "habito.habits.v2";
  const MKEY = "habito.moods.v2";
  const NKEY = "habito.name.v1";

  /* ---------- date helpers ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dow = (s) => (parse(s).getDay() + 6) % 7; // Mon=0..Sun=6
  const startOfWeek = (s) => addDays(s, -dow(s));
  const weekIndex = (s) => Math.floor(parse(startOfWeek(s)).getTime() / (7 * 864e5));

  const rid = () => "h_" + Math.random().toString(36).slice(2, 10);

  /* ---------- state ---------- */
  let habits = [];
  let moods = {};
  let client = null, mode = "local"; // 'local' | 'cloud'

  const saveLocal = () => { try { localStorage.setItem(HKEY, JSON.stringify(habits)); localStorage.setItem(MKEY, JSON.stringify(moods)); } catch (_) {} };

  /* ---------- habit due logic ---------- */
  function isDue(h, d) {
    if (h.freq === "Weekdays") return dow(d) < 5;
    if (h.freq === "Weekends") return dow(d) >= 5;
    if (h.freq === "Every other week") return weekIndex(d) % 2 === 0;
    return true; // "Every day" (default) — all 7 days tickable
  }

  /* ---------- load (called on sign-in) ---------- */
  async function load(user) {
    client = (window.Auth && window.Auth.client) || null;
    // pull a saved display name down from the account on a fresh device
    try {
      const md = user && user.user_metadata;
      const cloudName = md && (md.display_name || md.name);
      if (cloudName && !localStorage.getItem(NKEY)) localStorage.setItem(NKEY, cloudName);
    } catch (_) {}
    if (client && user && !user.demo) { mode = "cloud"; await loadCloud(); }
    else {
      mode = "local"; loadLocal();
      // Real accounts stay blank. The DEMO gets fake data once (for the
      // public showcase), and only on first launch — reset keeps it empty.
      if (user && user.demo) {
        let seeded = false; try { seeded = !!localStorage.getItem(DEMO_SEED_KEY); } catch (_) {}
        if (!seeded && !habits.length && !Object.keys(moods).length) seedDemo();
      }
    }
  }
  function loadLocal() {
    try { habits = JSON.parse(localStorage.getItem(HKEY)) || []; } catch (_) { habits = []; }
    try { moods = JSON.parse(localStorage.getItem(MKEY)) || {}; } catch (_) { moods = {}; }
  }

  /* ---------- demo seed (fake data for the public demo only) ---------- */
  const DEMO_SEED_KEY = "habito.demoSeeded.v1";
  const DEMO_AUDIT_KEY = "habito.audit.v2"; // matches screens.js AUDIT_KEY
  const SEED = [
    { name: "Read 20 pages", emoji: "📖", color: "pink",   freq: "Every day" },
    { name: "Workout",       emoji: "🏋️", color: "coral",  freq: "Weekdays" },
    { name: "Drink water",   emoji: "💧", color: "blue",   freq: "Every day" },
    { name: "Meditate",      emoji: "🧘", color: "purple", freq: "Every day" },
    { name: "Sleep 8h",      emoji: "🌙", color: "yellow", freq: "Every day" },
  ];
  function seedHistory(tpl, idx) {
    const done = {}, t = today();
    for (let i = 0; i < 119; i++) {
      const day = addDays(t, -i);
      if (!isDue(tpl, day)) continue;
      if (i === 0) { if ((idx + parse(day).getDate()) % 10 < 4) done[day] = true; }
      else if (i <= 6) { done[day] = true; }
      else { if ((idx * 3 + parse(day).getDate() * 7 + parse(day).getMonth()) % 10 < 8) done[day] = true; }
    }
    return done;
  }
  function seedDemo() {
    habits = SEED.map((s, idx) => ({ id: rid(), ...s, done: seedHistory(s, idx) }));
    const keys = ["happy", "calm", "happy", "sleepy", "calm", "anxious", "sad", "happy", "angry", "calm"];
    moods = {};
    const t = today();
    for (let i = 0; i < 50; i++) {
      const day = addDays(t, -i);
      const s = parse(day).getDate() * 3 + parse(day).getMonth();
      moods[day] = { key: keys[s % keys.length], sleep: 55 + (s % 9) * 5, stress: 22 + (s % 7) * 9 };
    }
    saveLocal();
    try {
      localStorage.setItem(DEMO_AUDIT_KEY, JSON.stringify({ sleep: 49, work: 40, learn: 8, train: 5, eat: 11, social: 12, scroll: 10, buffer: 33 }));
      localStorage.setItem(DEMO_SEED_KEY, "1");
    } catch (_) {}
  }
  // wipe everything back to a blank slate (local + cloud)
  async function resetAll() {
    habits = []; moods = {};
    try { localStorage.removeItem(HKEY); localStorage.removeItem(MKEY); } catch (_) {}
    if (mode === "cloud" && client) {
      try { await client.from("habits").delete().neq("id", "___none___"); } catch (_) {}
      try { await client.from("moods").delete().neq("date", "___none___"); } catch (_) {}
    }
  }
  async function loadCloud() {
    try {
      // Real accounts start BLANK. We never seed sample data into a real user's
      // account; they build it from scratch (after the onboarding tutorial).
      const { data: hs } = await client.from("habits").select("*").order("created_at");
      habits = (hs || []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color, freq: r.freq, done: r.done || {} }));
      const { data: ms } = await client.from("moods").select("*");
      moods = {};
      (ms || []).forEach((m) => { moods[m.date] = { key: m.key, sleep: m.sleep, stress: m.stress }; });
      saveLocal();
    } catch (e) { loadLocal(); } // network hiccup -> fall back to cached data
  }
  // is this a brand-new account with nothing yet? (drives the tutorial + empty states)
  const isNew = () => habits.length === 0 && Object.keys(moods).length === 0;

  /* ---------- write-through ---------- */
  const stripHabit = (h) => ({ id: h.id, name: h.name, emoji: h.emoji, color: h.color, freq: h.freq, done: h.done });
  const pushHabit = (h) => { if (mode === "cloud" && client) client.from("habits").upsert(stripHabit(h)).then(() => {}, () => {}); };
  const delHabit = (id) => { if (mode === "cloud" && client) client.from("habits").delete().eq("id", id).then(() => {}, () => {}); };
  const pushMood = (date, m) => { if (mode === "cloud" && client) client.from("moods").upsert({ date, key: m.key, sleep: m.sleep, stress: m.stress }).then(() => {}, () => {}); };

  /* ---------- habit API ---------- */
  const getHabits = () => habits;
  const getHabit = (id) => habits.find((h) => h.id === id);
  function addHabit({ name, emoji, color, freq }) {
    const h = { id: rid(), name, emoji, color, freq, done: {} };
    habits.push(h); saveLocal(); pushHabit(h); return h;
  }
  function removeHabit(id) { habits = habits.filter((h) => h.id !== id); saveLocal(); delHabit(id); }
  function toggle(id, dateISO) {
    const h = getHabit(id); if (!h) return;
    h.done = h.done || {};
    if (h.done[dateISO]) delete h.done[dateISO]; else h.done[dateISO] = true;
    saveLocal(); pushHabit(h);
  }
  const isDone = (id, dateISO) => { const h = getHabit(id); return !!(h && h.done && h.done[dateISO]); };

  /* ---------- derived: today ---------- */
  function dayScore(dateISO) {
    const due = habits.filter((h) => isDue(h, dateISO));
    if (!due.length) return 10;
    const done = due.filter((h) => isDone(h.id, dateISO)).length;
    return Math.round((done / due.length) * 100) / 10;
  }
  function dayProgress(dateISO) {
    const due = habits.filter((h) => isDue(h, dateISO));
    return { due: due.length, done: due.filter((h) => isDone(h.id, dateISO)).length };
  }

  /* ---------- derived: week matrix ---------- */
  function weekMatrix(anchorISO) {
    const start = startOfWeek(anchorISO || today());
    return habits.map((h) => ({
      habit: h,
      days: Array.from({ length: 7 }, (_, i) => {
        const dISO = addDays(start, i);
        return { iso: dISO, dow: i, due: isDue(h, dISO), done: isDone(h.id, dISO) };
      }),
    }));
  }

  /* ---------- derived: overall stats ---------- */
  function stats() {
    let earliest = today();
    habits.forEach((h) => Object.keys(h.done || {}).forEach((d) => { if (d < earliest) earliest = d; }));
    let totalDue = 0, totalDone = 0, completed = 0;
    for (let d = earliest; d <= today(); d = addDays(d, 1)) {
      habits.forEach((h) => { if (isDue(h, d)) { totalDue++; if (isDone(h.id, d)) { totalDone++; completed++; } } });
    }
    const success = totalDue ? Math.round((totalDone / totalDue) * 100) : 0;
    const counts = (d) => { const due = habits.filter((h) => isDue(h, d)); return due.length > 0 && due.every((h) => isDone(h.id, d)); };
    let best = 0, run = 0;
    for (let d = earliest; d <= today(); d = addDays(d, 1)) { if (counts(d)) { run++; best = Math.max(best, run); } else run = 0; }
    let current = 0, cur = today();
    if (!counts(cur)) cur = addDays(cur, -1);
    while (counts(cur)) { current++; cur = addDays(cur, -1); }
    return { current, success, best, completed };
  }

  function heatmap(id, weeks = 18) {
    if (!getHabit(id)) return [];
    const start = addDays(startOfWeek(today()), -(weeks - 1) * 7);
    const rows = Array.from({ length: 7 }, () => []);
    for (let w = 0; w < weeks; w++) {
      for (let r = 0; r < 7; r++) {
        const dISO = addDays(start, w * 7 + r);
        rows[r].push({ iso: dISO, due: isDue(getHabit(id), dISO), done: isDone(id, dISO), future: dISO > today() });
      }
    }
    return rows;
  }

  /* ---------- moods ---------- */
  function setMood(dateISO, entry) { moods[dateISO] = { ...(moods[dateISO] || {}), ...entry }; saveLocal(); pushMood(dateISO, moods[dateISO]); }
  function clearMood(dateISO) {
    delete moods[dateISO]; saveLocal();
    if (mode === "cloud" && client) client.from("moods").delete().eq("date", dateISO).then(() => {}, () => {});
  }
  const getMood = (dateISO) => moods[dateISO] || null;
  function monthMoods(year, month) {
    const out = {};
    Object.keys(moods).forEach((d) => { const dt = parse(d); if (dt.getFullYear() === year && dt.getMonth() === month) out[d] = moods[d]; });
    return out;
  }
  function moodSummary(year, month) {
    const m = monthMoods(year, month), tally = {};
    Object.values(m).forEach((e) => { if (e.key) tally[e.key] = (tally[e.key] || 0) + 1; });
    let top = null, n = 0;
    Object.entries(tally).forEach(([k, c]) => { if (c > n) { top = k; n = c; } });
    return { top, count: Object.keys(m).length, tally };
  }
  function recent(attr, n = 10) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const d = addDays(today(), -i); const e = moods[d]; out.push({ iso: d, val: e ? e[attr] : null }); }
    return out;
  }

  /* ---------- display name ---------- */
  const getName = () => { try { return localStorage.getItem(NKEY) || ""; } catch (_) { return ""; } };
  function setName(name) {
    name = (name || "").trim();
    try { name ? localStorage.setItem(NKEY, name) : localStorage.removeItem(NKEY); } catch (_) {}
    if (mode === "cloud" && client) { try { client.auth.updateUser({ data: { display_name: name } }); } catch (_) {} }
  }

  window.Store = {
    load, mode: () => mode, isNew, getName, setName, resetAll,
    today, iso, parse, addDays, startOfWeek, dow,
    getHabits, getHabit, addHabit, removeHabit, toggle, isDone, isDue,
    dayScore, dayProgress, weekMatrix, stats, heatmap,
    setMood, clearMood, getMood, monthMoods, moodSummary, recent,
    moodTotal: () => Object.keys(moods).length,
  };
})();
