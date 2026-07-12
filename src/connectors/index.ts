import type { Connector } from '../types';
import { githubConnector } from './github';
import { gitlabConnector } from './gitlab';
import { npmConnector } from './npmRegistry';
import { dockerhubConnector } from './dockerhub';
import { redditConnector } from './reddit';
import { hackernewsConnector } from './hackernews';
import { keybaseConnector } from './keybase';
import { gravatarConnector } from './gravatar';
import { dnsConnector } from './dns';
import { duckduckgoConnector } from './duckduckgo';
import { wikipediaConnector } from './wikipedia';
import { chessComConnector, lichessConnector, codeforcesConnector } from './gaming';
import { unverifiedSitesConnector } from './unverifiedSites';
import { emailFormatConnector } from './emailChecks';
import { numverifyConnector } from './numverify';
import { hunterConnector } from './hunter';
import { internetDbConnector, shodanConnector } from './shodan';
import { phoneLocalConnector } from './phoneLocal';
import { icDecoderConnector } from './icDecoders';
import { githubCommitsConnector } from './githubCommits';
import { ipGeoConnector } from './ipGeo';
import { rdapConnector } from './rdap';
import { googleDorkLinksConnector } from './googleDorkLinks';
import { googleCustomSearchConnector } from './googleCustomSearch';

export const CONNECTORS: Connector[] = [
  // Identity
  icDecoderConnector,
  githubCommitsConnector,
  // Accounts / username / social
  githubConnector,
  gitlabConnector,
  npmConnector,
  dockerhubConnector,
  redditConnector,
  hackernewsConnector,
  keybaseConnector,
  chessComConnector,
  lichessConnector,
  codeforcesConnector,
  unverifiedSitesConnector,
  // Email
  emailFormatConnector,
  gravatarConnector,
  hunterConnector,
  // Phone
  phoneLocalConnector,
  numverifyConnector,
  // Web / general
  dnsConnector,
  duckduckgoConnector,
  wikipediaConnector,
  internetDbConnector,
  shodanConnector,
  ipGeoConnector,
  rdapConnector,
  // Google dorking
  googleDorkLinksConnector,
  googleCustomSearchConnector,
];

export function connectorsFor(type: Connector['supports'][number]): Connector[] {
  return CONNECTORS.filter((c) => c.supports.includes(type));
}
