-- Whether the user took an as-needed (PRN) medication today, separate from
-- the scheduled-dose questions which only cover fixed-schedule medications.
ALTER TABLE public.daily_logs
  ADD COLUMN prn_taken boolean;
