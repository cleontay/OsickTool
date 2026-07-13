import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { Connector, Finding, SearchQuery } from '../types';
import { nextId } from '../lib/fetchUtils';
import { looksLikePhoneShape } from '../lib/classify';

/**
 * WhatsApp has no public, unauthenticated API or web page that returns a
 * contact's display name/about-text/photo for a given phone number - the
 * closest thing, web.whatsapp.com, only renders anything once *you're*
 * logged into your own WhatsApp Web session via QR pairing, which isn't
 * something a static client-only app can automate or should attempt to.
 *
 * What free is: WhatsApp's own "click to chat" deep link
 * (https://wa.me/<E.164 digits>), which opens a chat with that number in
 * WhatsApp (app or web) with no contact-list entry required. Opening it
 * yourself is the fastest real way to see whether the number is on
 * WhatsApp at all, and - depending on the owner's privacy settings - their
 * display name and profile photo. This connector only generates that link;
 * nothing is fetched on your behalf, mirroring the Google Dork feature's
 * "link-only" tier for the same reason (no free API exists to do more).
 */
export const whatsappConnector: Connector = {
  id: 'whatsapp',
  name: 'WhatsApp',
  description: 'Generates a WhatsApp "click to chat" link for a phone number - open it yourself to check the account manually (no public profile API exists).',
  supports: ['phone'],
  async run(query: SearchQuery): Promise<Finding[]> {
    if (!looksLikePhoneShape(query.value)) return [];

    const parsed = parsePhoneNumberFromString(query.value, query.country as CountryCode | undefined);
    if (!parsed) return [];
    const digits = parsed.format('E.164').replace('+', '');

    return [
      {
        id: nextId(),
        connectorId: 'whatsapp',
        connectorName: 'WhatsApp',
        tab: 'accounts',
        title: `WhatsApp: ${parsed.format('INTERNATIONAL')}`,
        detail: 'No public profile API exists for WhatsApp - open this link yourself to check for a display name, photo, or "about" text (visibility depends on the owner\'s privacy settings).',
        link: `https://wa.me/${digits}`,
        confidence: 'unverified',
        query,
        timestamp: Date.now(),
        data: { app: 'WhatsApp' },
      },
    ];
  },
};
