# Buddy Trip Golf

Live scoring and games app for a golf trip — skins, Nassau, stableford,
scramble, match play, and Ryder Cup, with a full trip setup wizard.

## What's here

This is a real, structured Next.js 14 (App Router) + Tailwind + Supabase
project — not a mockup. The scoring engine in `lib/scoring.ts` is fully
implemented and pure (no DB calls), so it's easy to unit test on its own.
The leaderboard page currently runs on demo data (`lib/demoData.ts`) so
you can see it working end-to-end before wiring up a real database.

```
app/
  page.tsx                          landing page
  trip/[tripId]/leaderboard/page.tsx  live leaderboard (demo data)
  trip/[tripId]/setup/page.tsx        5-step setup wizard
components/
  Leaderboard.tsx                   team/individual toggle, skins badges
  GameChips.tsx                     skins pot / games strip
  setup/                            Players, Teams, Foursomes, Scorekeeper, Rounds
lib/
  types.ts                          shared types (mirrors schema.sql)
  scoring.ts                        skins, nassau, stableford, match play,
                                     scramble, ryder cup — pure functions
  demoData.ts                       fake trip data for local preview
  supabase.ts                       client + realtime subscription helper
  courseData.ts                     stub for course/tee autofill — wire up
                                     a provider (e.g. golfapi.io) here
supabase/
  schema.sql                        run this in the Supabase SQL editor
```

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

Visit `http://localhost:3000` — you'll see links to the demo leaderboard
and the setup wizard.

## Wiring up real data

1. Create a project at supabase.com.
2. Paste `supabase/schema.sql` into the SQL editor and run it.
3. Copy your project URL and anon key into `.env.local`.
4. In `app/trip/[tripId]/leaderboard/page.tsx`, replace the demo data
   import with real Supabase queries (a TODO comment marks the spot).
5. Optional: sign up for a golf course data API (golfapi.io or similar)
   and fill in `GOLF_COURSE_API_KEY` + the two functions in
   `lib/courseData.ts` to get automatic par/stroke-index lookup on the
   Rounds setup step.

## Not built yet

- Auth (currently anyone with a trip link can read/write — see the RLS
  comment in schema.sql)
- Wiring the setup wizard's state to Supabase (it currently holds
  everything in local React state and doesn't persist)
- Wolf and 666 games (cut from scope — see conversation history)
- High-Low game (mentioned as a future addition, not yet in scoring.ts)
- PWA manifest / install-to-homescreen config

This is a solid foundation to keep building in Claude Code, where it can
install dependencies, run the dev server, and iterate against real data.
