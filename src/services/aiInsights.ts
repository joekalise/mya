import { supabase } from '@/services/supabase';
import { DailyLog, ExertionEvent, Crash, UserProfile, HealthData, RecoverySnapshot } from '@/types';

export interface WeeklyInsight {
  summary: string;
  points: Array<{ title: string; detail: string }>;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function callClaude(body: object): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Claude proxy error: ${response.status}`);
  const data = await response.json();
  if (!data?.text) throw new Error('No text in Claude proxy response');
  return data.text;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildHealthSummary(healthHistory: HealthData[], recoveryData?: RecoverySnapshot | null): string {
  const withHRV = healthHistory.filter((d) => d.hrv !== null);
  const withSleep = healthHistory.filter((d) => d.sleep_duration !== null);
  const withHR = healthHistory.filter((d) => d.resting_heart_rate !== null);
  const withSteps = healthHistory.filter((d) => d.steps !== null);

  if (withHRV.length === 0 && withSleep.length === 0 && withHR.length === 0 && withSteps.length === 0) {
    return '';
  }

  const lines: string[] = [`\n\nHEALTH DATA (last ${healthHistory.length} days with data, from Apple Health):`];

  if (withHRV.length > 0) {
    const avgHRV = (withHRV.reduce((s, d) => s + d.hrv!, 0) / withHRV.length).toFixed(1);
    const recent = withHRV.slice(-3);
    const earlier = withHRV.slice(0, -3);
    let trend = '';
    if (recent.length >= 2 && earlier.length >= 2) {
      const rHRV = recent.reduce((s, d) => s + d.hrv!, 0) / recent.length;
      const eHRV = earlier.reduce((s, d) => s + d.hrv!, 0) / earlier.length;
      const pct = ((eHRV - rHRV) / eHRV) * 100;
      if (pct >= 10) trend = ` (down ${pct.toFixed(0)}% vs earlier — reduced HRV is linked to fatigue severity and autonomic stress in ME/CFS research)`;
      else if (pct <= -10) trend = ' (up — recovering)';
    }
    lines.push(`- Average HRV: ${avgHRV}ms${trend}`);
  }

  if (withSteps.length > 0) {
    const avgSteps = Math.round(withSteps.reduce((s, d) => s + d.steps!, 0) / withSteps.length);
    lines.push(`- Average daily steps: ${avgSteps.toLocaleString()} (useful as an objective exertion signal even on days with no manually logged exertion event)`);
  }

  if (withSleep.length > 0) {
    const avgSleep = (withSleep.reduce((s, d) => s + d.sleep_duration!, 0) / withSleep.length).toFixed(1);
    lines.push(`- Average sleep: ${avgSleep}h`);
  }

  if (withHR.length > 0) {
    const avgHR = Math.round(withHR.reduce((s, d) => s + d.resting_heart_rate!, 0) / withHR.length);
    lines.push(`- Average resting heart rate: ${avgHR}bpm`);
  }

  if (recoveryData) {
    if (recoveryData.oxygen_saturation !== null) {
      lines.push(`- Overnight SpO2 (today): ${recoveryData.oxygen_saturation}%${recoveryData.oxygen_saturation < 94 ? ' (below normal range)' : ''}`);
    }
    if (recoveryData.respiratory_rate !== null) {
      lines.push(`- Sleep respiratory rate (today): ${recoveryData.respiratory_rate} breaths/min${recoveryData.respiratory_rate > 18 ? ' (elevated, may indicate autonomic arousal)' : ''}`);
    }
  }

  return lines.join('\n');
}

function buildDataSummary(
  logs: DailyLog[],
  exertionEvents: ExertionEvent[],
  crashes: Crash[],
  healthHistory: HealthData[],
  recoveryData?: RecoverySnapshot | null
): string {
  if (logs.length === 0) {
    return 'No tracking data available for this period.';
  }

  const avgBell = logs.filter((l) => l.bell_score_today !== null);
  const avgBellScore = avgBell.length > 0
    ? (avgBell.reduce((s, l) => s + (l.bell_score_today ?? 0), 0) / avgBell.length).toFixed(0)
    : null;
  const avgFatigue = (logs.reduce((s, l) => s + l.fatigue_score, 0) / logs.length).toFixed(1);

  const cognitiveLogs = logs.filter((l) => l.cognitive_dysfunction_score !== null);
  const avgCognitive = cognitiveLogs.length > 0
    ? (cognitiveLogs.reduce((s, l) => s + (l.cognitive_dysfunction_score ?? 0), 0) / cognitiveLogs.length).toFixed(1)
    : null;

  const pemDays = logs.filter((l) => l.pem_today).length;

  const notes = logs
    .filter((l) => l.notes && l.notes.trim().length > 0)
    .map((l) => `  [${formatDate(l.date)}] ${l.notes.trim()}`)
    .join('\n');

  const exertionSummary = exertionEvents.length === 0
    ? 'No exertion events logged in this period.'
    : exertionEvents
        .map((e) => `  - ${new Date(e.occurred_at).toLocaleDateString('en-GB')} (${e.exertion_type}, intensity ${e.intensity}${e.duration_minutes ? `, ${e.duration_minutes}min` : ''})`)
        .join('\n');

  const crashSummary = crashes.length === 0
    ? 'No crashes logged in this period.'
    : crashes
        .map((c) => `  - ${formatDate(c.start_date)} to ${c.end_date ? formatDate(c.end_date) : 'ongoing'} (${c.severity}${c.pem_delay_hours !== null ? `, ${c.pem_delay_hours}h after exertion` : ''}, symptoms: ${c.symptoms.join(', ') || 'none noted'})`)
        .join('\n');

  const healthSection = buildHealthSummary(healthHistory, recoveryData);

  return `
TRACKING DATA SUMMARY (last 28 days, ${logs.length} days logged):
- Average functional level (Bell scale): ${avgBellScore ?? 'not recorded'}/100
- Average fatigue: ${avgFatigue}/10
${avgCognitive ? `- Average cognitive dysfunction: ${avgCognitive}/10` : ''}
- Crash (PEM) days: ${pemDays} of ${logs.length} logged days

EXERTION EVENTS:
${exertionSummary}

CRASHES:
${crashSummary}

USER NOTES (free text from check-ins):
${notes || '  None'}${healthSection}
`.trim();
}

function buildProfileSummary(profile: UserProfile): string {
  return `
USER PROFILE:
- Diagnosis criteria: ${profile.diagnosis_criteria ?? 'not specified'}
- Baseline functional level (Bell scale): ${profile.bell_score_baseline ?? 'not specified'}
- Typical PEM onset delay: ${profile.pem_onset_delay ?? 'not specified'}
- Typical PEM duration: ${profile.pem_duration_typical ?? 'not specified'}
- Mobility status: ${profile.mobility_status ?? 'not specified'}
- Primary symptoms: ${profile.primary_symptoms?.join(', ') || 'none specified'}
- Comorbidities: ${profile.comorbidities?.join(', ') || 'none'}
${profile.ai_context ? `- Additional context from user: ${profile.ai_context}` : ''}
`.trim();
}

export async function generateWeeklyInsight(params: {
  logs: DailyLog[];
  exertionEvents: ExertionEvent[];
  crashes: Crash[];
  profile: UserProfile;
  healthHistory?: HealthData[];
  recoveryData?: RecoverySnapshot | null;
}): Promise<WeeklyInsight> {
  const { logs, exertionEvents, crashes, profile, healthHistory = [], recoveryData } = params;

  const systemPrompt = `You are Mya, a data analyst for someone living with ME/CFS. Your job is to find the strongest correlations between exertion, post-exertional malaise (PEM) crashes, and daily function — not to reassure, but to produce something the user could show a doctor who doubts them.

Respond with a JSON object in exactly this structure:
{
  "summary": "2-3 sentences on the single strongest pattern this period. Always include real numbers.",
  "points": [
    { "title": "3-5 word title", "detail": "2-3 sentences." },
    { "title": "3-5 word title", "detail": "2-3 sentences." },
    { "title": "3-5 word title", "detail": "2-3 sentences." }
  ]
}

RULES:
1. Prioritize PEM correlations: does exertion (by type/intensity) precede crashes by a consistent delay? Use the format "on days when X, Y averaged..." wherever possible.
2. Where Apple Health data is present, treat steps as an objective exertion signal even on days with no manually logged exertion event, and HRV trend as an autonomic/overexertion signal — both are research-backed for ME/CFS, not just self-report.
3. Every insight must include a real number — averages, day counts, hours of delay. Never write vague statements without a number attached.
4. Be honest and direct, not reassuring. If a pattern is concerning, say so plainly.
5. Never diagnose, never say "you are at risk", never recommend specific medications.
6. Use language like "your data shows" and "in your case" — this is evidence, not advice.
7. 3 points always. Valid JSON only, no markdown, no text outside the JSON.`;

  const userMessage = `Here is my health data:

${buildProfileSummary(profile)}

${buildDataSummary(logs, exertionEvents, crashes, healthHistory, recoveryData)}`;

  try {
    const text = await callClaude({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    return JSON.parse(jsonMatch[0]) as WeeklyInsight;
  } catch (err) {
    console.error('generateWeeklyInsight error:', err);
    throw new Error('AI insights are temporarily unavailable. The rest of the app is working normally.');
  }
}

// ─── sendChatMessage ──────────────────────────────────────────────────────────

export async function sendChatMessage(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  logs: DailyLog[];
  exertionEvents: ExertionEvent[];
  crashes: Crash[];
  profile: UserProfile;
  healthHistory?: HealthData[];
  recoveryData?: RecoverySnapshot | null;
  aiContext?: string;
  language?: string;
}): Promise<string> {
  const { messages, logs, exertionEvents, crashes, profile, healthHistory = [], recoveryData, aiContext, language } = params;
  const langInstruction = language && language !== 'en-GB' ? `\nRespond in ${language}.` : '';

  const systemPrompt = `You are Mya, a knowledgeable companion for someone living with ME/CFS, think of yourself as a friend who also has ME/CFS, who happens to have read all the research and can see all their tracking data.${langInstruction}

You have the user's full symptom log, exertion events, crash (PEM) history, health data, and profile. When a question relates to their patterns or history, answer using their actual data, real numbers, not generic advice.

Here is the user's profile and recent data:

${buildProfileSummary(profile)}

${buildDataSummary(logs, exertionEvents, crashes, healthHistory, recoveryData)}
${aiContext ? `\nAdditional context from user: ${aiContext}` : ''}

How to respond:
- Match length to the question. A simple question gets 1-2 sentences. A pattern or trigger question gets a detailed breakdown with numbers.
- When the data is relevant, lead with what it actually shows: "On your X logged days, Y averaged Z..."
- Sound like a knowledgeable friend, not a medical professional or wellness app. Be direct, not clinical.
- Never diagnose, never say "you are at risk", never recommend specific medications or doses.
- Do not open with "Great question!", "Of course!", "Certainly!", or any filler. Never start a response with "I".
- Key ME/CFS factors: post-exertional malaise (PEM) and its delay, pacing within the energy envelope, unrefreshing sleep, cognitive dysfunction, orthostatic intolerance.
- If something is outside your knowledge or can't be answered from the data, say so clearly and suggest they raise it with their doctor.
- Never use em dashes or en dashes. Use a comma, period, or plain hyphen instead.`;

  try {
    return await callClaude({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err) {
    console.error('sendChatMessage error:', err);
    throw new Error('AI chat is temporarily unavailable. Please try again in a moment.');
  }
}
