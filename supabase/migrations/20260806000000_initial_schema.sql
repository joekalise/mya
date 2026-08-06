-- ============================================================
-- Mya — initial database schema
-- Safe to run on a fresh project (all statements are idempotent)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────────

-- Profiles (one per user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  age_range             text,
  biological_sex        text,
  diagnosis_criteria    text,   -- fukuda | canadian_consensus_criteria | international_consensus_criteria | iom_seid | not_formally_diagnosed | other
  diagnosis_years       text,   -- not_diagnosed | under_1 | 1_3 | 3_5 | 5_10 | 10_plus
  bell_score_baseline   integer CHECK (bell_score_baseline IS NULL OR (bell_score_baseline >= 0 AND bell_score_baseline <= 100)),
  pem_onset_delay       text,   -- same_day | next_day | 24_72h | variable
  pem_duration_typical  text,   -- hours | one_day | several_days | week_plus | variable
  mobility_status       text,   -- none | mobility_aid | wheelchair_part_time | wheelchair_full_time | housebound | bedbound
  primary_symptoms      text[] DEFAULT '{}',
  comorbidities         text[] DEFAULT '{}',
  medications           text[] DEFAULT '{}',
  challenges            text[] DEFAULT '{}',
  notification_time     text DEFAULT '20:00',
  ai_context            text DEFAULT '',
  onboarding_complete   boolean DEFAULT false,
  welcome_message       text,
  preferred_name        text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Daily check-in
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date                        date NOT NULL,
  bell_score_today            integer CHECK (bell_score_today IS NULL OR (bell_score_today >= 0 AND bell_score_today <= 100)),
  fatigue_score               integer CHECK (fatigue_score >= 0 AND fatigue_score <= 10),
  cognitive_dysfunction_score integer CHECK (cognitive_dysfunction_score IS NULL OR (cognitive_dysfunction_score >= 0 AND cognitive_dysfunction_score <= 10)),
  pain_score                  integer CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10)),
  woke_rested                 boolean,
  pem_today                   boolean DEFAULT false,
  dizzy_on_standing           boolean,
  palpitations                boolean,
  unsteady_on_feet             boolean,
  cold_limbs                  boolean,
  temperature_dysregulation   boolean,
  flu_like_symptoms           boolean,
  sensory_chemical_reaction   boolean,
  medications_taken           text,  -- yes | no | partial
  notes                       text DEFAULT '',
  created_at                  timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Exertion events — physical/cognitive/emotional/social exertion, logged per event
CREATE TABLE IF NOT EXISTS public.exertion_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  occurred_at      timestamptz NOT NULL,
  exertion_type    text NOT NULL,  -- physical | cognitive | emotional | social
  intensity        integer NOT NULL CHECK (intensity >= 1 AND intensity <= 5),
  duration_minutes integer,
  notes            text DEFAULT '',
  created_at       timestamptz DEFAULT now()
);

-- Daily energy envelope — user-set budget vs. spend derived from exertion_events
CREATE TABLE IF NOT EXISTS public.daily_envelope (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date          date NOT NULL,
  budget_points integer CHECK (budget_points IS NULL OR budget_points >= 0),
  spent_points  integer CHECK (spent_points IS NULL OR spent_points >= 0),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Crashes (PEM episodes) — distinct from Fibro's flares: can link back to a
-- candidate triggering exertion event, since the defining feature of PEM is
-- the delayed onset (0-72h) after exertion, not a same-day event.
CREATE TABLE IF NOT EXISTS public.crashes (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date                     date NOT NULL,
  end_date                       date,
  severity                       text,  -- mild | moderate | severe
  symptoms                       text[] DEFAULT '{}',
  likely_trigger_exertion_event_id uuid REFERENCES public.exertion_events(id) ON DELETE SET NULL,
  pem_delay_hours                integer CHECK (pem_delay_hours IS NULL OR pem_delay_hours >= 0),
  notes                          text DEFAULT '',
  created_at                     timestamptz DEFAULT now()
);

-- DSQ-SF (DePaul Symptom Questionnaire — Short Form) responses.
-- Developed by Leonard A. Jason, PhD, DePaul University. Raw item responses
-- are stored here; domain/case-definition scoring is computed in the app —
-- see CLAUDE.md for the attribution requirement wherever these are shown.
CREATE TABLE IF NOT EXISTS public.dsq_sf_scores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date       date NOT NULL,
  freq_1     integer CHECK (freq_1 BETWEEN 0 AND 4), sev_1  integer CHECK (sev_1  BETWEEN 0 AND 4),
  freq_2     integer CHECK (freq_2 BETWEEN 0 AND 4), sev_2  integer CHECK (sev_2  BETWEEN 0 AND 4),
  freq_3     integer CHECK (freq_3 BETWEEN 0 AND 4), sev_3  integer CHECK (sev_3  BETWEEN 0 AND 4),
  freq_4     integer CHECK (freq_4 BETWEEN 0 AND 4), sev_4  integer CHECK (sev_4  BETWEEN 0 AND 4),
  freq_5     integer CHECK (freq_5 BETWEEN 0 AND 4), sev_5  integer CHECK (sev_5  BETWEEN 0 AND 4),
  freq_6     integer CHECK (freq_6 BETWEEN 0 AND 4), sev_6  integer CHECK (sev_6  BETWEEN 0 AND 4),
  freq_7     integer CHECK (freq_7 BETWEEN 0 AND 4), sev_7  integer CHECK (sev_7  BETWEEN 0 AND 4),
  freq_8     integer CHECK (freq_8 BETWEEN 0 AND 4), sev_8  integer CHECK (sev_8  BETWEEN 0 AND 4),
  freq_9     integer CHECK (freq_9 BETWEEN 0 AND 4), sev_9  integer CHECK (sev_9  BETWEEN 0 AND 4),
  freq_10    integer CHECK (freq_10 BETWEEN 0 AND 4), sev_10 integer CHECK (sev_10 BETWEEN 0 AND 4),
  freq_11    integer CHECK (freq_11 BETWEEN 0 AND 4), sev_11 integer CHECK (sev_11 BETWEEN 0 AND 4),
  freq_12    integer CHECK (freq_12 BETWEEN 0 AND 4), sev_12 integer CHECK (sev_12 BETWEEN 0 AND 4),
  freq_13    integer CHECK (freq_13 BETWEEN 0 AND 4), sev_13 integer CHECK (sev_13 BETWEEN 0 AND 4),
  freq_14    integer CHECK (freq_14 BETWEEN 0 AND 4), sev_14 integer CHECK (sev_14 BETWEEN 0 AND 4),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Apple Health / Health Connect data
CREATE TABLE IF NOT EXISTS public.health_data (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date                date NOT NULL,
  steps               integer,
  sleep_duration      numeric(5,2),
  sleep_quality       numeric(3,1),
  hrv                 numeric(6,2),
  resting_heart_rate  numeric(5,1),
  active_calories     numeric(8,2),
  workouts            integer,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Medication reminders
CREATE TABLE IF NOT EXISTS public.medications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name           text NOT NULL,
  dose           text,
  frequency      text NOT NULL,
  reminder_time  text,
  active         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- Nudges / smart notifications log
CREATE TABLE IF NOT EXISTS public.nudges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sent_at      timestamptz DEFAULT now(),
  trigger_type text NOT NULL,
  message      text NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exertion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_envelope ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crashes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsq_sf_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges         ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view own profile') THEN
    CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can delete own profile') THEN
    CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Users manage own daily logs') THEN
    CREATE POLICY "Users manage own daily logs" ON public.daily_logs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exertion_events' AND policyname='Users manage own exertion events') THEN
    CREATE POLICY "Users manage own exertion events" ON public.exertion_events FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_envelope' AND policyname='Users manage own daily envelope') THEN
    CREATE POLICY "Users manage own daily envelope" ON public.daily_envelope FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crashes' AND policyname='Users manage own crashes') THEN
    CREATE POLICY "Users manage own crashes" ON public.crashes FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dsq_sf_scores' AND policyname='Users manage own dsq scores') THEN
    CREATE POLICY "Users manage own dsq scores" ON public.dsq_sf_scores FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='health_data' AND policyname='Users manage own health data') THEN
    CREATE POLICY "Users manage own health data" ON public.health_data FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medications' AND policyname='Users manage own medications') THEN
    CREATE POLICY "Users manage own medications" ON public.medications FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nudges' AND policyname='Users view own nudges') THEN
    CREATE POLICY "Users view own nudges" ON public.nudges FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nudges' AND policyname='Users insert own nudges') THEN
    CREATE POLICY "Users insert own nudges" ON public.nudges FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nudges' AND policyname='Users delete own nudges') THEN
    CREATE POLICY "Users delete own nudges" ON public.nudges FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS daily_logs_user_date        ON public.daily_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS exertion_events_user_time   ON public.exertion_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS daily_envelope_user_date     ON public.daily_envelope(user_id, date DESC);
CREATE INDEX IF NOT EXISTS crashes_user_start           ON public.crashes(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS crashes_trigger_event        ON public.crashes(likely_trigger_exertion_event_id);
CREATE INDEX IF NOT EXISTS dsq_sf_scores_user_date      ON public.dsq_sf_scores(user_id, date DESC);
CREATE INDEX IF NOT EXISTS health_data_user_date        ON public.health_data(user_id, date DESC);
CREATE INDEX IF NOT EXISTS nudges_user_sent             ON public.nudges(user_id, sent_at DESC);

-- ────────────────────────────────────────────────────────────
-- TRIGGERS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS daily_envelope_updated_at ON public.daily_envelope;
CREATE TRIGGER daily_envelope_updated_at
  BEFORE UPDATE ON public.daily_envelope
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- AUTH: configure email redirect URL
-- (do this in Dashboard → Authentication → URL Configuration)
-- Allowed redirect URLs should include: mya://
-- ────────────────────────────────────────────────────────────
