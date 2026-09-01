import i18n from '@/i18n';

export function getPrivacyPolicyUrl(): string {
  return i18n.language.startsWith('es')
    ? 'https://valimia.com/es/apps/mya/privacy/'
    : 'https://valimia.com/apps/mya/privacy/';
}
