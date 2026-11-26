# PUTTER: football analysis and value-pick platform

Putter finds upcoming football matches, analyses form, injuries and bookmaker prices, and publishes only selections that clear value and reliability checks (decimal odds ≥ 2.00 by default). Every published pick is stored permanently and settled automatically, so the track record is transparent.

> Predictions are probabilities, not guarantees. No model beats bookmakers every day. Putter is built to be honest about that: it blends its models with the de-vigged market price, grades picks GREEN / AMBER / RED, and says "no qualified selections" on quiet days.

## How it fits together

```
GitHub Actions (scheduled)            Supabase (Postgres)            Android app
  backend/src/pipeline.js  ──writes──▶  fixtures, picks, runs  ◀─reads─  Kotlin + Compose
  backend/src/settle-run.js              config (editable)               Room offline cache
  backend/src/closing-run.js             RLS: app is read-only           WorkManager refresh
        ▲ API-Football + The Odds API (keys live only in GitHub Secrets)
```

* `backend/`: analysis engine (Poisson with Dixon-Coles correction, goal-difference rating, Monte Carlo, ensemble), value maths, accumulator maths, providers, pipeline, settlement. Plain Node 20+, no dependencies. `cd backend && npm test`.
* `android/`: native app (Kotlin, Jetpack Compose, MVVM, Retrofit, Room, WorkManager). Dark navy and electric green theme. Sections: Home, Today's Picks, Fixtures, Analysis, Accumulator, Results, Profile.
* `backend/sql/schema.sql`: tables, row-level security and triggers that make published picks immutable and undeletable.

## One-time setup

1. **Supabase** (free tier is fine): create a project, open the SQL editor, run `backend/sql/schema.sql`.
2. **API keys**: [API-Football](https://www.api-football.com/) key and [The Odds API](https://the-odds-api.com/) key.
3. **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

   | Secret | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_KEY` | `service_role` key (backend only; never put in the app) |
   | `SUPABASE_ANON_KEY` | `anon` key (baked into the APK, read-only by RLS) |
   | `API_FOOTBALL_KEY` | API-Football key |
   | `ODDS_API_KEY` | The Odds API key |
   | `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` | *Optional.* A stable signing key so updates install over older versions |

4. **Actions tab**: run *Build Android APK* manually (or push a tag like `v1.0.0` to publish a Release). Download `Putter.apk` from the run's artifacts or the Release.
5. Run *Putter daily analysis* once manually. Tick **demo** to see the app working before you have API keys; demo rows are clearly labelled and never graded GREEN.

Schedules: analysis twice daily, results and closing odds every 30 minutes.

## Configuration without rebuilding

Edit rows in the Supabase `config` table: `settings` (minimum odds, EV and quality thresholds, fixtures per run, look-ahead days), `odds_sport_keys` (competitions to scan), `leagues_enabled` (API-Football league ids, empty = all matched).

## What is and is not in this version

Included: 1X2, double chance, draw no bet, over/under 1.5/2.5/3.5, BTTS; live odds from bookmakers with bookmaker name and update time; de-vigged market cross-check; exact same-match accumulator correlation; track record by league, market, week and month; closing line value; offline cache.

Not yet (stated honestly rather than faked): corners, cards, first/second-half goals, player markets and Asian handicap odds ingestion (the engine understands Asian handicap, but the free odds feed does not supply it); expected goals from the data provider (the model uses it automatically when a provider supplies it; API-Football's per-match xG needs one extra call per match, so it is off); weather; a news feed; an in-app admin console (use Supabase).

Free API tiers are small (API-Football free = 100 calls/day), which limits how many matches are analysed per day. Raise `max_fixtures_per_run` only if your plan allows it.

## Responsible betting

Never stake money you cannot afford to lose. Past performance does not guarantee future results. Help: begambleaware.org, gamblingtherapy.org.
