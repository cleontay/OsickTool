import type { Connector, Finding, SearchQuery } from '../types';
import { nextId } from '../lib/fetchUtils';
import { DISPOSABLE_EMAIL_DOMAINS, FREE_EMAIL_PROVIDERS } from '../data/disposableDomains';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailFormatConnector: Connector = {
  id: 'email-format',
  name: 'Email Analysis',
  description: 'Local, offline analysis of the email address structure - validity, domain type, and username pivot.',
  supports: ['email'],
  async run(query: SearchQuery): Promise<Finding[]> {
    const value = query.value.trim();
    const valid = EMAIL_RE.test(value);
    const findings: Finding[] = [];

    if (!valid) {
      findings.push({
        id: nextId(),
        connectorId: 'email-format',
        connectorName: 'Email Analysis',
        tab: 'email',
        title: 'Malformed email address',
        detail: 'This does not look like a syntactically valid email address.',
        confidence: 'info',
        query,
        timestamp: Date.now(),
      });
      return findings;
    }

    const [localPart, domain] = value.split('@');
    const domainLower = domain.toLowerCase();
    const isDisposable = DISPOSABLE_EMAIL_DOMAINS.has(domainLower);
    const isFreeProvider = FREE_EMAIL_PROVIDERS.has(domainLower);
    const hasPlusTag = localPart.includes('+');
    const plusTag = hasPlusTag ? localPart.split('+')[1] : undefined;

    findings.push({
      id: nextId(),
      connectorId: 'email-format',
      connectorName: 'Email Analysis',
      tab: 'email',
      title: `Email: ${value}`,
      detail: isDisposable
        ? 'Domain matches a known disposable/temporary email provider.'
        : isFreeProvider
          ? 'Domain is a well-known free consumer email provider.'
          : 'Domain appears to be a custom/organizational domain - worth checking WHOIS and DNS.',
      confidence: 'confirmed',
      query,
      timestamp: Date.now(),
      data: {
        localPart,
        domain: domainLower,
        disposable: isDisposable,
        freeProvider: isFreeProvider,
        plusTag: plusTag ?? undefined,
      },
    });

    return findings;
  },
};
