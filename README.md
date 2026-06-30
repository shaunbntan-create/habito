# Habito

A playful habit tracker and mood journal. Build the days you want, one square at a time.

**Live demo:** https://shaunbntan-create.github.io/habito/ · tap **explore the demo** to try it instantly, no signup.

![Habito](assets/cover.png)

## What it does

- **Habits**
  - **Today** — a ring of your habits around a live daily score, with a summary of the week
  - **Weekly** — tap Mon–Sun circles to check off each habit
  - **Overall** — current streak, success rate, best streak, and a GitHub-style contribution heatmap per habit
- **Mood** — a one-tap "how are you feeling" check-in, sleep + stress trends, and a full mood calendar with a monthly summary
- **The 168 Audit** — you get 168 hours a week; pour them into buckets and see where they actually go (and where they leak)
- **Accounts** — sign in with email (magic link) or Google; your habits and moods sync to your account across devices

## Tech

Deliberately simple, no build step:

- Vanilla **HTML + CSS + JavaScript** (zero framework, zero bundler)
- **Supabase** for auth (email magic-link + Google OAuth) and data (Postgres + row-level security)
- **Fredoka** + **Plus Jakarta Sans** type, a custom pastel design system
- Hosted free on **GitHub Pages**

## Run it locally

```bash
git clone https://github.com/shaunbntan-create/habito.git
cd habito
python -m http.server 8200
# open http://localhost:8200
```

It works out of the box in local demo mode (data in your browser). To enable real accounts, add your own Supabase keys in `config.js`.

## Configure Supabase (optional)

1. Create a free project at [supabase.com](https://supabase.com).
2. Put your Project URL + anon key in `config.js`.
3. Run the SQL in `supabase/schema.sql` to create the `habits` and `moods` tables with row-level security.
4. In Authentication → URL Configuration, add your site + `http://localhost:8200/**` to the redirect allowlist.

The `anon` key is safe to commit, it is meant for the browser and is protected by row-level security. Never commit the `service_role` key.

## License

MIT. Built by Shaun Tan.
