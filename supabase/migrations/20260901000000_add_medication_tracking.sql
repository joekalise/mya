-- PRN/as-needed medications have no fixed reminder schedule.
ALTER TABLE public.medications ADD COLUMN as_needed boolean NOT NULL DEFAULT false;

-- How many times a day the user takes medication, drives whether the daily
-- log asks one generic yes/no/partial question or splits it by dose slot.
ALTER TABLE public.profiles
  ADD COLUMN medication_doses_per_day integer NOT NULL DEFAULT 1
  CHECK (medication_doses_per_day BETWEEN 1 AND 3);

-- Per-dose-slot medication-taken answers, used when medication_doses_per_day > 1.
ALTER TABLE public.daily_logs
  ADD COLUMN medications_taken_dose_1 text CHECK (medications_taken_dose_1 IN ('yes', 'no', 'partial')),
  ADD COLUMN medications_taken_dose_2 text CHECK (medications_taken_dose_2 IN ('yes', 'no', 'partial')),
  ADD COLUMN medications_taken_dose_3 text CHECK (medications_taken_dose_3 IN ('yes', 'no', 'partial'));
