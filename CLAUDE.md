# Mya — ME/CFS tracking app

Third app in the suite alongside Spondy (ankylosing spondylitis, `~/spondy`)
and Fibro (fibromyalgia, `~/fibro`). Same stack and architectural lineage:
Expo/React Native, expo-router, Supabase, i18next, EAS, RevenueCat,
HealthKit/Health Connect, Claude-generated insights, PDF export.

Core differentiator: people with ME/CFS routinely aren't believed, by
doctors, employers, family. The product's job is producing credible
evidence — consistent dated logs, PEM/crash correlation, functional
capacity over time — not just personal insight. Weight product and UX
decisions toward credibility and shareability.

Condition-specific design (does not map cleanly from Fibro):
- Post-Exertional Malaise (PEM) is the hallmark symptom — a delayed
  (0-72hr) crash after physical, cognitive, emotional, or social
  exertion. User-facing term is "Crash" (patients' most-preferred wording
  for PEM), not "flare" — "flare" reads as borrowed from
  arthritis/fibro-type conditions in this community.
- Pacing uses Leonard Jason's Energy Envelope model: users rate
  "available energy" vs "expended energy" (0-100 scale each day), not a
  generic activity-level tag.
- Severity uses Bell's CFS Disability Scale (0-100, in steps of 10),
  not a generic mild/moderate/severe enum — this is the scale the
  community and clinical trials actually use.
- Clinical instrument is the DePaul Symptom Questionnaire — Short Form
  (DSQ-SF), 14 items, dual 0-4 frequency/severity scale, developed by
  Leonard A. Jason, PhD (DePaul University). Credit him wherever DSQ-SF
  results are shown to the user or exported (questionnaire screen, PDF
  export footer, About/methodology section).
- Orthostatic intolerance / POTS tracking is deferred past v1.

# Spanish translation review queue

`src/i18n/locales/es.json` is the Spanish translation of `en-GB.json`. There's a
local, Excel-based review process for keeping it in sync, since the user
reviews Spanish copy by hand rather than trusting a model-written translation
outright.

**Whenever you add a new key to `en-GB.json`, or change the English text of an
existing key**, run this before ending your turn:

```
python3 scripts/i18n_sync_review_queue.py
```

This diffs `en-GB.json` against `scripts/i18n_baseline.json` (a snapshot of
English text as of the last closed review), appends anything new or changed to
`scripts/i18n_pending_review.txt`, and regenerates
`~/Downloads/mya_es_review.xlsx` with the full outstanding queue (columns:
Namespace, Key, Source (en-GB), Target (es), Reviewed (Y/N)). Mention in your
turn summary that new strings were queued for review, don't just do it silently.

When the user says they've reviewed the spreadsheet (they've filled in/edited
the Target (es) column and marked Reviewed as Y for the rows they checked),
run:

```
python3 scripts/i18n_close_review.py
```

This only closes rows marked `Y` in Reviewed (the Target column is pre-filled
from the current es.json for context, so a non-empty Target alone does not
mean it was reviewed). It writes the accepted translations into `es.json`,
removes those keys from the pending queue, advances the baseline for those
keys so they won't be re-flagged, and regenerates the xlsx with whatever's
still outstanding.

Never hand-edit `es.json` values directly for keys that are sitting in the
pending queue awaiting review, unless the user explicitly asks you to fix a
specific translation right now (e.g. a live bug report), in that case, after
fixing it, still run the sync script so the fix gets captured in the baseline
correctly (or just remove it from `i18n_pending_review.txt` by hand if it's
not already there).

Never use em or en dashes in any copy you write, in either locale file, or in
these scripts' own output and comments. Rewrite instead.
