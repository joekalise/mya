export type AgeRange = 'under_25' | '25_35' | '35_45' | '45_55' | '55_plus';
export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';
export type DiagnosisCriteria =
  | 'fukuda'
  | 'canadian_consensus_criteria'
  | 'international_consensus_criteria'
  | 'iom_seid'
  | 'not_formally_diagnosed'
  | 'other';
export type DiagnosisYears = 'not_diagnosed' | 'under_1' | '1_3' | '3_5' | '5_10' | '10_plus';
export type PemOnsetDelay = 'same_day' | 'next_day' | '24_72h' | 'variable';
export type PemDurationTypical = 'hours' | 'one_day' | 'several_days' | 'week_plus' | 'variable';
export type MobilityStatus =
  | 'none'
  | 'mobility_aid'
  | 'wheelchair_part_time'
  | 'wheelchair_full_time'
  | 'housebound'
  | 'bedbound';
export type PrimarySymptom =
  | 'fatigue'
  | 'pem'
  | 'unrefreshing_sleep'
  | 'cognitive_dysfunction'
  | 'orthostatic_intolerance'
  | 'pain'
  | 'sensory_sensitivity'
  | 'temperature_dysregulation'
  | 'immune_flulike'
  | 'gi_issues';
export type Comorbidity =
  | 'pots'
  | 'fibromyalgia'
  | 'mcas'
  | 'eds'
  | 'ibs'
  | 'migraine'
  | 'anxiety_depression'
  | 'mold_illness'
  | 'other';
export type Medication =
  | 'low_dose_naltrexone'
  | 'beta_blockers'
  | 'antihistamines_h1_h2'
  | 'stimulants'
  | 'antidepressants'
  | 'anticoagulants'
  | 'no_medication'
  | 'other';
export type LifestyleChallenge = 'sleep' | 'exercise' | 'work' | 'social_life' | 'mental_health';

export type ExertionType = 'physical' | 'cognitive' | 'emotional' | 'social';
export type CrashSeverity = 'mild' | 'moderate' | 'severe';
export type MedsTaken = 'yes' | 'no' | 'partial';

export interface UserProfile {
  id?: string;
  user_id: string;
  age_range: AgeRange | null;
  biological_sex?: BiologicalSex | null;
  diagnosis_criteria: DiagnosisCriteria | null;
  diagnosis_years: DiagnosisYears | null;
  bell_score_baseline: number | null;
  pem_onset_delay: PemOnsetDelay | null;
  pem_duration_typical: PemDurationTypical | null;
  mobility_status: MobilityStatus | null;
  primary_symptoms: PrimarySymptom[];
  comorbidities: Comorbidity[];
  medications: Medication[];
  medication_doses_per_day: number;
  challenges: LifestyleChallenge[];
  notification_time: string;
  ai_context: string;
  onboarding_complete: boolean;
  welcome_message?: string;
  preferred_name?: string | null;
}

export interface DailyLog {
  id?: string;
  user_id: string;
  date: string;
  bell_score_today: number | null;
  fatigue_score: number | null;
  cognitive_dysfunction_score: number | null;
  pain_score: number | null;
  woke_rested: boolean | null;
  pem_today: boolean;
  dizzy_on_standing: boolean | null;
  palpitations: boolean | null;
  unsteady_on_feet: boolean | null;
  cold_limbs: boolean | null;
  temperature_dysregulation: boolean | null;
  flu_like_symptoms: boolean | null;
  sensory_chemical_reaction: boolean | null;
  medications_taken: MedsTaken | null;
  medications_taken_dose_1: MedsTaken | null;
  medications_taken_dose_2: MedsTaken | null;
  medications_taken_dose_3: MedsTaken | null;
  prn_taken: boolean | null;
  notes: string;
}

export interface ExertionEvent {
  id?: string;
  user_id: string;
  occurred_at: string;
  exertion_type: ExertionType;
  intensity: number; // 1-5
  duration_minutes: number | null;
  notes: string;
}

export interface DailyEnvelope {
  id?: string;
  user_id: string;
  date: string;
  budget_points: number | null;
  spent_points: number | null;
}

export interface Crash {
  id?: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  severity: CrashSeverity | null;
  symptoms: string[];
  likely_trigger_exertion_event_id: string | null;
  pem_delay_hours: number | null;
  notes: string;
}

// DePaul Symptom Questionnaire - Short Form (DSQ-SF).
// Developed by Leonard A. Jason, PhD, DePaul University.
// Each item has a 0-4 frequency rating and a 0-4 severity rating.
export const DSQ_SF_ITEMS = [
  'fatigue',
  'next_day_soreness',
  'minimum_exercise_tired',
  'unrefreshed_on_waking',
  'muscle_pain',
  'bloating',
  'memory_problems',
  'attention_difficulty',
  'irritable_bowel',
  'unsteady_on_feet',
  'cold_limbs',
  'hot_or_cold_for_no_reason',
  'flu_like_symptoms',
  'sensory_chemical_reaction',
] as const;

export type DsqSfItem = (typeof DSQ_SF_ITEMS)[number];

export interface DsqSfScore {
  id?: string;
  user_id: string;
  date: string;
  freq_1: number; sev_1: number;
  freq_2: number; sev_2: number;
  freq_3: number; sev_3: number;
  freq_4: number; sev_4: number;
  freq_5: number; sev_5: number;
  freq_6: number; sev_6: number;
  freq_7: number; sev_7: number;
  freq_8: number; sev_8: number;
  freq_9: number; sev_9: number;
  freq_10: number; sev_10: number;
  freq_11: number; sev_11: number;
  freq_12: number; sev_12: number;
  freq_13: number; sev_13: number;
  freq_14: number; sev_14: number;
}

export interface HealthData {
  id?: string;
  user_id: string;
  date: string;
  steps: number | null;
  sleep_duration: number | null;
  sleep_quality: number | null;
  hrv: number | null;
  resting_heart_rate: number | null;
  active_calories: number | null;
  workouts: number | null;
  temperature: number | null;
  apparent_temperature: number | null;
  uv_index: number | null;
  air_quality_index: number | null;
}

// In-memory only - not persisted to Supabase (no DB migration needed)
export interface RecoverySnapshot {
  oxygen_saturation: number | null;
  respiratory_rate: number | null;
  mindful_minutes: number | null;
}

export interface MedicationReminder {
  id?: string;
  user_id: string;
  name: string;
  dose: string;
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly';
  reminder_time: string;
  active: boolean;
  as_needed?: boolean;
}

export interface Nudge {
  id?: string;
  user_id: string;
  sent_at: string;
  trigger_type: string;
  message: string;
}

export interface OnboardingData {
  age_range: AgeRange | null;
  biological_sex: BiologicalSex | null;
  diagnosis_criteria: DiagnosisCriteria | null;
  diagnosis_years: DiagnosisYears | null;
  bell_score_baseline: number | null;
  pem_onset_delay: PemOnsetDelay | null;
  pem_duration_typical: PemDurationTypical | null;
  mobility_status: MobilityStatus | null;
  primary_symptoms: PrimarySymptom[];
  comorbidities: Comorbidity[];
  medications: Medication[];
  challenges: LifestyleChallenge[];
  notification_time: string;
}

export interface WelcomeContent {
  welcome_message: string;
  insights: string[];
  watch_summary: string;
}
