import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import i18n from '@/i18n';
import { DailyLog, Crash, DsqSfScore, DailyEnvelope, MedicationReminder, UserProfile } from '@/types';

const t = i18n.t.bind(i18n);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
}

function crashDays(start: string, end: string | null): number {
  const s = new Date(start + 'T12:00:00');
  const e = end ? new Date(end + 'T12:00:00') : new Date();
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000));
}

function labelList(values: string[], namespace: string): string {
  return values.map((v) => t(`${namespace}.${v}`)).join(', ');
}

// Picks the _one/_other key directly instead of relying on i18next's
// automatic count-based suffix resolution, which silently falls back to
// v3-style keys and fails to resolve on devices without a working
// Intl.PluralRules.
function tPlural(key: string, count: number): string {
  return count === 1 ? t(`${key}_one`, { count }) : t(`${key}_other`, { count });
}

// Frequency x severity per item, summed and normalised to 0-100. Mirrors the
// composite computed in Insights — a symptom-burden indicator, not an
// official DSQ-SF classification score (the instrument itself doesn't
// reduce to one number in clinical use).
function computeDsqSfScore(score: DsqSfScore): number {
  let total = 0;
  for (let i = 1; i <= 14; i++) {
    const freq = (score as unknown as Record<string, number>)[`freq_${i}`] ?? 0;
    const sev = (score as unknown as Record<string, number>)[`sev_${i}`] ?? 0;
    total += freq * sev;
  }
  return Math.round((total / (14 * 4 * 4)) * 100);
}

function dsqSfInterpretation(score: number): { label: string; color: string } {
  if (score < 40) return { label: t('insights.dsq_sf_mild'), color: '#22C55E' };
  if (score < 60) return { label: t('insights.dsq_sf_moderate'), color: '#EAB308' };
  return { label: t('insights.dsq_sf_severe'), color: '#EF4444' };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildReportHTML(params: {
  logs: DailyLog[];
  crashes: Crash[];
  envelopes: DailyEnvelope[];
  medications: MedicationReminder[];
  profile: UserProfile;
  dsqSfScores?: DsqSfScore[];
  fromDate?: string;
}): string {
  const { logs, crashes, envelopes, medications, profile, dsqSfScores = [] } = params;

  const now = new Date();
  const reportStart = params.fromDate
    ? new Date(params.fromDate + 'T00:00:00')
    : (() => { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; })();

  const reportFromDate = fmtDate(reportStart.toISOString().split('T')[0]);
  const reportToDate = fmtDate(now.toISOString().split('T')[0]);
  const generatedAt = now.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Functional level & symptoms ─────────────────────────────────────────────
  const bellLogs = logs.filter((l) => l.bell_score_today !== null);
  const avgBell = bellLogs.length > 0
    ? (bellLogs.reduce((s, l) => s + (l.bell_score_today ?? 0), 0) / bellLogs.length).toFixed(0)
    : t('pdf_export.none_reported');

  const brainFogLogs = logs.filter((l) => l.cognitive_dysfunction_score !== null);
  const avgBrainFog = brainFogLogs.length > 0
    ? (brainFogLogs.reduce((s, l) => s + (l.cognitive_dysfunction_score ?? 0), 0) / brainFogLogs.length).toFixed(1)
    : t('pdf_export.none_reported');

  const lowFunctionDays = bellLogs.filter((l) => (l.bell_score_today ?? 100) <= 40).length;

  // ── Energy envelope / pacing ─────────────────────────────────────────────────
  const envelopeDays = envelopes.filter((e) => e.budget_points !== null && e.spent_points !== null);
  const avgAvailable = envelopeDays.length > 0
    ? Math.round(envelopeDays.reduce((s, e) => s + (e.budget_points ?? 0), 0) / envelopeDays.length)
    : null;
  const avgSpent = envelopeDays.length > 0
    ? Math.round(envelopeDays.reduce((s, e) => s + (e.spent_points ?? 0), 0) / envelopeDays.length)
    : null;
  const overspentDays = envelopeDays.filter((e) => (e.spent_points ?? 0) > (e.budget_points ?? 0)).length;
  const overspentPct = envelopeDays.length > 0 ? Math.round((overspentDays / envelopeDays.length) * 100) : null;

  // ── Medication adherence ──────────────────────────────────────────────────────
  const medYes = logs.filter((l) => l.medications_taken === 'yes').length;
  const medPartial = logs.filter((l) => l.medications_taken === 'partial').length;
  const medNo = logs.filter((l) => l.medications_taken === 'no').length;
  const totalCheckins = medYes + medPartial + medNo;
  const adherencePct = totalCheckins > 0 ? Math.round((medYes / totalCheckins) * 100) : null;

  // ── Notes ──────────────────────────────────────────────────────────────────────
  const notesWithContent = logs.filter((l) => l.notes && l.notes.trim().length > 0).reverse();

  // ── Medications list ────────────────────────────────────────────────────────────
  const medList = medications.filter((m) => m.active).map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''} (${m.frequency})`).join(', ');

  // ── Crash rows ───────────────────────────────────────────────────────────────
  const crashRowsHTML = crashes.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#78716C;font-style:italic;">${t('pdf_export.crash_none')}</td></tr>`
    : crashes.map((c) => `
        <tr>
          <td>${fmtDateShort(c.start_date)}</td>
          <td>${c.end_date ? fmtDateShort(c.end_date) : `<em>${t('pdf_export.crash_ongoing')}</em>`}</td>
          <td>${tPlural('pdf_export.crash_days', crashDays(c.start_date, c.end_date))}</td>
          <td style="text-transform:capitalize;">${c.severity ? t(`crashes.severity_${c.severity}`) : t('pdf_export.none_reported')}</td>
          <td>${c.pem_delay_hours !== null ? t('pdf_export.crash_delay_hours', { hours: c.pem_delay_hours }) : t('pdf_export.none_reported')}</td>
        </tr>`).join('');

  // ── DSQ-SF rows ──────────────────────────────────────────────────────────────
  const dsqSfRowsHTML = [...dsqSfScores].sort((a, b) => a.date.localeCompare(b.date)).map((s) => {
    const score = computeDsqSfScore(s);
    const interp = dsqSfInterpretation(score);
    return `<tr>
      <td>${fmtDateShort(s.date)}</td>
      <td style="font-weight:700;color:${interp.color};">${score}/100</td>
      <td>${interp.label}</td>
    </tr>`;
  }).join('');

  // ── Notes HTML ───────────────────────────────────────────────────────────────
  const notesHTML = notesWithContent.length === 0
    ? `<p style="color:#78716C;font-style:italic;">${t('pdf_export.notes_none')}</p>`
    : notesWithContent.map((l) => `
        <div class="note-entry">
          <span class="note-date">${fmtDateShort(l.date)}</span>
          <span class="note-text">${l.notes}</span>
        </div>`).join('');

  return `<!DOCTYPE html>
<html lang="${i18n.language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t('pdf_export.title')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      color: #1C1917;
      background: #FFFFFF;
      padding: 40px 48px;
      line-height: 1.5;
    }
    h1 { font-size: 26px; font-weight: 800; color: #F97316; margin-bottom: 4px; }
    h2 {
      font-size: 15px; font-weight: 700; color: #1C1917;
      margin-bottom: 12px; margin-top: 28px;
      padding-bottom: 6px; border-bottom: 2px solid #F97316;
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #E7E5E4;
    }
    .header-right { text-align: right; font-size: 12px; color: #78716C; }
    .subtitle { font-size: 13px; color: #78716C; }
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 8px; }
    .profile-row { display: flex; gap: 8px; }
    .profile-label { font-weight: 600; color: #78716C; font-size: 12px; min-width: 160px; }
    .profile-value { font-size: 12px; color: #1C1917; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 13px; }
    th {
      background: #FFF7ED; color: #C2410C; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 10px;
      text-align: left; border: 1px solid #E7E5E4;
    }
    td { padding: 8px 10px; border: 1px solid #E7E5E4; vertical-align: top; }
    tr:nth-child(even) td { background: #FAFAF9; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 4px; }
    .stat-box { border: 1px solid #E7E5E4; border-radius: 8px; padding: 14px 12px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: #F97316; }
    .stat-label { font-size: 11px; color: #78716C; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    .adherence-row { display: flex; gap: 16px; margin-top: 4px; }
    .adh-box { border: 1px solid #E7E5E4; border-radius: 8px; padding: 12px 16px; text-align: center; min-width: 80px; }
    .adh-count { font-size: 22px; font-weight: 800; }
    .adh-label { font-size: 11px; color: #78716C; margin-top: 4px; }
    .note-entry { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #E7E5E4; font-size: 13px; }
    .note-date { font-weight: 700; color: #78716C; min-width: 70px; flex-shrink: 0; }
    .note-text { color: #1C1917; }
    .callout {
      background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 8px;
      padding: 10px 14px; margin-top: 8px; font-size: 12px; color: #78716C;
    }
    .footer {
      margin-top: 40px; padding-top: 16px; border-top: 1px solid #E7E5E4;
      font-size: 11px; color: #A8A29E; text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${t('pdf_export.title')}</h1>
      <p class="subtitle">${t('pdf_export.subtitle')}</p>
    </div>
    <div class="header-right">
      <div>${t('pdf_export.generated_label')}: ${generatedAt}</div>
      <div>${t('pdf_export.period_label')}: ${t('pdf_export.period_range', { from: reportFromDate, to: reportToDate })}</div>
      <div style="margin-top:4px;">${tPlural('pdf_export.days_tracked', logs.length)}</div>
    </div>
  </div>

  <!-- Patient info -->
  <h2>${t('pdf_export.section_patient_profile')}</h2>
  <div class="profile-grid">
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_age_range')}</span>
      <span class="profile-value">${profile.age_range ? t(`onboarding.age_range.${profile.age_range}`) : t('pdf_export.none_reported')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_years_since_diagnosis')}</span>
      <span class="profile-value">${profile.diagnosis_years ? t(`onboarding.diagnosis_years.${profile.diagnosis_years}`) : t('pdf_export.none_reported')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_diagnosis_criteria')}</span>
      <span class="profile-value">${profile.diagnosis_criteria ? t(`onboarding.diagnosis_criteria.${profile.diagnosis_criteria}`) : t('pdf_export.none_reported')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_bell_baseline')}</span>
      <span class="profile-value">${profile.bell_score_baseline !== null ? `${profile.bell_score_baseline}/100` : t('pdf_export.none_reported')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_primary_symptoms')}</span>
      <span class="profile-value">${profile.primary_symptoms.length > 0 ? labelList(profile.primary_symptoms, 'onboarding.primary_symptoms') : t('pdf_export.none_reported')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_comorbidities')}</span>
      <span class="profile-value">${profile.comorbidities.length > 0 ? labelList(profile.comorbidities, 'onboarding.comorbidities') : t('pdf_export.none_reported')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-label">${t('pdf_export.field_active_medications')}</span>
      <span class="profile-value">${medList || t('pdf_export.none_reported')}</span>
    </div>
  </div>

  <!-- Functional level & symptoms -->
  <h2>${t('pdf_export.section_functional_level')}</h2>
  <div class="stat-grid">
    <div class="stat-box">
      <div class="stat-value">${avgBell}</div>
      <div class="stat-label">${t('pdf_export.stat_avg_bell')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${avgBrainFog}</div>
      <div class="stat-label">${t('pdf_export.stat_avg_brain_fog')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${lowFunctionDays}</div>
      <div class="stat-label">${t('pdf_export.stat_low_function_days')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${logs.length}</div>
      <div class="stat-label">${t('pdf_export.stat_days_logged')}</div>
    </div>
  </div>

  <!-- Energy envelope / pacing -->
  <h2>${t('pdf_export.section_pacing')}</h2>
  <div class="stat-grid">
    <div class="stat-box">
      <div class="stat-value">${avgAvailable ?? t('pdf_export.none_reported')}</div>
      <div class="stat-label">${t('pdf_export.stat_avg_available')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${avgSpent ?? t('pdf_export.none_reported')}</div>
      <div class="stat-label">${t('pdf_export.stat_avg_spent')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${overspentDays}</div>
      <div class="stat-label">${t('pdf_export.stat_overspent_days')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${overspentPct !== null ? `${overspentPct}%` : t('pdf_export.none_reported')}</div>
      <div class="stat-label">${t('pdf_export.stat_overspent_rate')}</div>
    </div>
  </div>
  <p class="callout">${t('pdf_export.pacing_callout')}</p>

  <!-- Crashes / PEM -->
  <h2>${t('pdf_export.section_crashes')}</h2>
  <table>
    <thead>
      <tr><th>${t('pdf_export.crash_start_header')}</th><th>${t('pdf_export.crash_end_header')}</th><th>${t('pdf_export.crash_duration_header')}</th><th>${t('pdf_export.crash_severity_header')}</th><th>${t('pdf_export.crash_delay_header')}</th></tr>
    </thead>
    <tbody>${crashRowsHTML}</tbody>
  </table>

  ${dsqSfScores.length > 0 ? `
  <!-- DSQ-SF -->
  <h2>${t('pdf_export.section_dsq_sf')}</h2>
  <table>
    <thead><tr><th>${t('pdf_export.dsq_sf_date_header')}</th><th>${t('pdf_export.dsq_sf_score_header')}</th><th>${t('pdf_export.dsq_sf_interpretation_header')}</th></tr></thead>
    <tbody>${dsqSfRowsHTML}</tbody>
  </table>
  <p class="callout">${t('pdf_export.dsq_sf_callout')}</p>
  ` : ''}

  <!-- Medication adherence -->
  <h2>${t('pdf_export.section_medication_adherence')}</h2>
  <div class="adherence-row">
    <div class="adh-box">
      <div class="adh-count" style="color:#22C55E;">${medYes}</div>
      <div class="adh-label">${t('pdf_export.adherence_fully_taken')}</div>
    </div>
    <div class="adh-box">
      <div class="adh-count" style="color:#EAB308;">${medPartial}</div>
      <div class="adh-label">${t('pdf_export.adherence_partial')}</div>
    </div>
    <div class="adh-box">
      <div class="adh-count" style="color:#EF4444;">${medNo}</div>
      <div class="adh-label">${t('pdf_export.adherence_missed')}</div>
    </div>
    <div class="adh-box">
      <div class="adh-count" style="color:#78716C;">${totalCheckins}</div>
      <div class="adh-label">${t('pdf_export.adherence_total_checkins')}</div>
    </div>
    ${adherencePct !== null ? `
    <div class="adh-box">
      <div class="adh-count" style="color:${adherencePct >= 80 ? '#22C55E' : adherencePct >= 50 ? '#EAB308' : '#EF4444'};">${adherencePct}%</div>
      <div class="adh-label">${t('pdf_export.adherence_rate')}</div>
    </div>` : ''}
  </div>

  <!-- Patient notes -->
  <h2>${t('pdf_export.section_notes')}</h2>
  ${notesHTML}

  <div class="footer">
    ${t('pdf_export.footer_text', { date: generatedAt })}<br />
    ${t('pdf_export.dsq_sf_attribution')}
  </div>
</body>
</html>`;
}

// ─── generateAndShareReport ───────────────────────────────────────────────────

export async function generateAndShareReport(params: {
  logs: DailyLog[];
  crashes: Crash[];
  envelopes: DailyEnvelope[];
  medications: MedicationReminder[];
  profile: UserProfile;
  dsqSfScores?: DsqSfScore[];
  fromDate?: string;
}): Promise<void> {
  const html = buildReportHTML(params);

  const { uri } = await Print.printToFileAsync({ html });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  const dateStamp = new Date().toISOString().split('T')[0];
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `mya_health_summary_${dateStamp}.pdf`,
    UTI: 'com.adobe.pdf',
  });
}
