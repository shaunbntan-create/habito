/* ============================================================
   Habito — data store (habits + moods)
   Cloud-backed via Supabase when signed in (per-user, RLS),
   localStorage for demo mode + as an offline cache.
   Dates are ISO "YYYY-MM-DD". Week starts Monday.
   ============================================================ */
(function () {
  const HKEY = "habito.habits.v1";
  const MKEY = "habito.moods.v1";
  const NKEY = "habito.name.v1";

  /* ---------- date helpers ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dow = (s) => (parse(s).getDay() + 6) % 7; // Mon=0..Sun=6
  const startOfWeek = (s) => addDays(s, -dow(s));

  /* ---------- seed templates (ids generated per user) ---------- */
  const SEED = [
    { name: "Do meditation",            emoji: "🧘", color: "pink",   freq: "Everyday" },
    { name: "Drink 10 glasses of water", emoji: "💧", color: "blue",   freq: "Everyday" },
    { name: "Take your medications",     emoji: "💊", color: "green",  freq: "5 days per week" },
    { name: "Sleep at least 8 hours",    emoji: "🌙", color: "yellow", freq: "Everyday" },
    { name: "Work at least 6 hours",     emoji: "💻", color: "purple", freq: "5 days per week" },
  ];
  const rid = () => "h_" + Math.random().toString(36).slice(2, 10);

  /* ---------- state ---------- */
  let habits = [];
  let moods = {};
  let client = null, mode = "local"; // 'local' | 'cloud'

  const saveLocal = () => { try { localStorage.setItem(HKEY, JSON.stringify(habits)); localStorage.setItem(MKEY, JSON.stringify(moods)); } catch (_) {} };

  /* ---------- habit due logic ---------- */
  function isDue(h, d) {
    if (h.freq === "Everyday") return true;
    if (h.freq === "5 days per week") return dow(d) < 5;
    if (h.freq === "Weekends") return dow(d) >= 5;
    return true;
  }

  /* ---------- seeding (realistic demo history) ---------- */
  function seedHistory(tpl, idx) {
    const done = {};
    const t = today();
    for (let i = 0; i < 112; i++) {
      const day = addDays(t, -i);
      if (!isDue(tpl, day)) continue;
      if (i === 0) { if ((idx + parse(day).getDate()) % 10 < 4) done[day] = true; }
      else if (i <= 7) { done[day] = true; }
      else { const k = (idx * 3 + parse(day).getDate() * 7 + parse(day).getMonth()) % 10; if (k < 8) done[day] = true; }
    }
    return done;
  }
  const seedHabits = () => SEED.map((s, idx) => ({ id: rid(), ...s, done: seedHistory(s, idx) }));
  function seedMoods() {
    const m = {};
    const keys = ["happy", "calm", "happy", "sleepy", "calm", "anxious", "sad", "happy", "angry", "calm"];
    const t = today();
    for (let i = 0; i < 30; i++) {
      const day = addDays(t, -i);
      const seed = parse(day).getDate() * 3 + parse(day).getMonth();
      m[day] = { key: keys[seed % keys.length], sleep: Math.round((6.2 + (seed % 6) * 0.45) * 10) / 10, stress: ["Low", "Mid", "High", "Low", "Mid"][seed % 5] };
    }
    return m;
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
    else { mode = "local"; loadLocal(); }
  }
  function loadLocal() {
    try { habits = JSON.parse(localStorage.getItem(HKEY)) || []; } catch (_) { habits = []; }
    try { moods = JSON.parse(localStorage.getItem(MKEY)) || {}; } catch (_) { moods = {}; }
    if (!habits.length) habits = seedHabits();
    if (!Object.keys(moods).length) moods = seedMoods();
    saveLocal();
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
    load, mode: () => mode, isNew, getName, setName,
    today, iso, parse, addDays, startOfWeek, dow,
    getHabits, getHabit, addHabit, removeHabit, toggle, isDone, isDue,
    dayScore, dayProgress, weekMatrix, stats, heatmap,
    setMood, getMood, monthMoods, moodSummary, recent,
    moodTotal: () => Object.keys(moods).length,
  };
})();
