-- Persist daily weather readings alongside HealthKit data so they can be
-- correlated against crashes and functional level (heat intolerance and
-- worsened autonomic symptoms in hot weather are well documented in
-- ME/CFS and POTS).
ALTER TABLE public.health_data
  ADD COLUMN IF NOT EXISTS temperature integer,
  ADD COLUMN IF NOT EXISTS apparent_temperature integer,
  ADD COLUMN IF NOT EXISTS uv_index numeric(3,1),
  ADD COLUMN IF NOT EXISTS air_quality_index integer;
