/* ============================================================
   Habito — app boot + router (login wiring this pass;
   habit/mood screens render here in the next pass)
   ============================================================ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- live status-bar clock ---------- */
  function tickClock() {
    const el = $(".sb-time");
    if (!el) return;
    const d = new Date();
    let h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
    el.textContent = `${h}:${m}`;
  }

  /* ---------- screen routing ---------- */
  let booted = false;
  async function showApp(e) {
    const u = e && e.detail;
    if (u && window.Screens) window.Screens.setUser(u);
    if (window.Store) { try { await window.Store.load(u); } catch (_) {} }
    $("#login").hidden = true; $("#app").hidden = false;
    if (window.Screens && !booted) { window.Screens.go("habits"); booted = true; }
    else if (window.Screens) window.Screens.go("habits");
  }
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }

  window.addEventListener("habito:signedin", showApp);
  window.addEventListener("habito:signedout", showLogin);

  /* ---------- bottom nav ---------- */
  function wireNav() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (window.Screens) window.Screens.go(btn.dataset.tab);
      });
    });
    const fab = $("#fab");
    if (fab) fab.addEventListener("click", () => window.Screens && window.Screens.openAdd());
  }

  /* ---------- login interactions ---------- */
  function note(msg, isErr) {
    const n = $("#emailNote");
    n.textContent = msg || "";
    n.classList.toggle("err", !!isErr);
  }

  function wireLogin() {
    $("#btnGoogle").addEventListener("click", async () => { note(""); const r = await Auth.signInGoogle(); if (r && r.error) note(r.error, true); });
    $("#btnApple").addEventListener("click", async () => { note(""); const r = await Auth.signInApple(); if (r && r.error) note(r.error, true); });
    $("#btnDemo").addEventListener("click", () => Auth.exploreDemo());

    const submitEmail = async () => {
      const email = $("#emailInput").value.trim();
      note("");
      const res = await Auth.signInEmail(email);
      if (res && res.ok && res.sent) note("Check your inbox for a magic link.");
      else if (res && res.demo) { /* signed in via demo fallback */ }
      else if (res && res.error) note(res.error, true);
    };
    $("#btnEmail").addEventListener("click", submitEmail);
    $("#emailInput").addEventListener("keydown", (e) => { if (e.key === "Enter") submitEmail(); });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    tickClock();
    setInterval(tickClock, 15000);
    wireLogin();
    wireNav();
    if (window.Screens) window.Screens.init();
    Auth.init();
  });
})();
