/* ============================================================
   Habito — auth layer (Supabase + graceful local demo)
   Emits window events: "habito:signedin" (detail=user) and
   "habito:signedout". If no Supabase keys are set, everything
   falls back to a local demo session so the app is always usable.
   ============================================================ */
(function () {
  const cfg = window.HABITO_CONFIG || {};
  const hasKeys = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let client = null;

  if (hasKeys && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const DEMO_KEY = "habito.demoUser";
  const redirect = () => location.href.split("#")[0];
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  function demoIn(label) {
    const user = { id: "demo", email: label || "demo@habito.app", demo: true, name: "you" };
    localStorage.setItem(DEMO_KEY, JSON.stringify(user));
    emit("habito:signedin", user);
    return { ok: true, demo: true };
  }

  async function currentUser() {
    if (client) {
      const { data } = await client.auth.getUser();
      if (data && data.user) return data.user;
    }
    const d = localStorage.getItem(DEMO_KEY);
    return d ? JSON.parse(d) : null;
  }

  async function init() {
    if (client) {
      client.auth.onAuthStateChange((_evt, session) => {
        if (session && session.user) emit("habito:signedin", session.user);
        else emit("habito:signedout");
      });
    }
    const u = await currentUser();
    if (u) emit("habito:signedin", u);
    else emit("habito:signedout");
  }

  function providerMsg(name, error) {
    const m = (error && error.message) || "";
    if (/not enabled|unsupported|provider/i.test(m)) return `${name} sign-in is coming soon. Use email for now.`;
    return m || `${name} sign-in failed.`;
  }

  async function signInGoogle() {
    if (!client) return demoIn("google@demo");
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
    return error ? { ok: false, error: providerMsg("Google", error) } : { ok: true };
  }

  async function signInApple() {
    if (!client) return demoIn("apple@demo");
    const { error } = await client.auth.signInWithOAuth({ provider: "apple", options: { redirectTo: redirect() } });
    return error ? { ok: false, error: providerMsg("Apple", error) } : { ok: true };
  }

  async function signInEmail(email) {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
    if (!client) return demoIn(email);
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
    return error ? { ok: false, error: error.message } : { ok: true, sent: true };
  }

  function exploreDemo() { return demoIn("demo@habito.app"); }

  async function signOut() {
    if (client) { try { await client.auth.signOut(); } catch (_) {} }
    localStorage.removeItem(DEMO_KEY);
    emit("habito:signedout");
  }

  window.Auth = { init, signInGoogle, signInApple, signInEmail, exploreDemo, signOut, currentUser, hasKeys, client };
})();
