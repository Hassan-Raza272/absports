import { Match } from '../types';
import { parseBallLabel } from './commentary';
import { legalBallsPerOver, resolveMatchSettings } from './matchSettings';

const WAGON_ZONES = ['Fine Leg', 'Square Leg', 'Mid Wicket', 'Long On', 'Long Off', 'Cover', 'Point', 'Third Man'];

export type Partnership = {
  wicket: number;
  runs: number;
  balls: number;
  batterA: string;
  batterB: string;
};

export type FallOfWicket = {
  wicket: number;
  score: number;
  overs: string;
  batter: string;
};

export type OverBucket = {
  over: number;
  runs: number;
  wickets: number;
  balls: string[];
};

export type WagonShot = {
  zone: string;
  runs: number;
  count: number;
};

export function parseZoneFromLabel(label: string): string | null {
  const idx = label.indexOf('→');
  if (idx < 0) return null;
  return label.slice(idx + 1).trim() || null;
}

export function buildPartnershipsAndFow(match: Match, innings: 1 | 2): {
  partnerships: Partnership[];
  fow: FallOfWicket[];
} {
  const inn = innings === 1 ? match.innings?.first : match.innings?.second;
  const log = match.liveScoring?.ballLog || [];
  if (!inn) return { partnerships: [], fow: [] };

  // Reconstruct from batting card + ball log when possible.
  const batting = inn.batting || [];
  const dismissed = batting.filter(b => b.status === 'OUT' || (b.out && b.status !== 'NOT_OUT'));
  const notOut = batting.filter(b => b.status === 'NOT_OUT' || (!b.out && b.status !== 'OUT'));

  const fow: FallOfWicket[] = [];
  let running = 0;
  dismissed.forEach((batter, i) => {
    running += batter.runs || 0;
    const extrasShare = Math.round(((inn.extras?.total || 0) * (i + 1)) / Math.max(1, dismissed.length + notOut.length));
    fow.push({
      wicket: i + 1,
      score: Math.min(inn.runs, running + extrasShare),
      overs: `${inn.overs}.${inn.balls}`,
      batter: batter.name,
    });
  });

  const partners: Partnership[] = [];
  const names = batting.map(b => b.name);
  for (let i = 0; i < Math.max(0, names.length - 1); i++) {
    const a = batting[i];
    const b = batting[i + 1];
    if (!a || !b) continue;
    partners.push({
      wicket: i + 1,
      runs: (a.runs || 0) + (i === 0 ? (b.runs || 0) : 0),
      balls: (a.balls || 0) + (i === 0 ? (b.balls || 0) : 0),
      batterA: a.name,
      batterB: b.name,
    });
  }

  if (notOut.length >= 2) {
    partners.push({
      wicket: dismissed.length + 1,
      runs: (notOut[0].runs || 0) + (notOut[1].runs || 0),
      balls: (notOut[0].balls || 0) + (notOut[1].balls || 0),
      batterA: notOut[0].name,
      batterB: notOut[1].name,
    });
  }

  if (partners.length === 0 && names.length) {
    partners.push({
      wicket: 1,
      runs: inn.runs,
      balls: (inn.overs || 0) * 6 + (inn.balls || 0),
      batterA: names[0],
      batterB: names[1] || '—',
    });
  }

  // Refine FOW overs from ball log wickets when available.
  if (log.length) {
    const settings = resolveMatchSettings(match);
    const bpo = legalBallsPerOver(settings);
    let legal = 0;
    let wicketNo = 0;
    let score = 0;
    log.forEach(raw => {
      const parsed = parseBallLabel(raw.split('→')[0]);
      const extraLegal = !parsed.extra || parsed.base.toLowerCase().startsWith('b') || parsed.base.toLowerCase().startsWith('lb');
      const isWideOrNb = parsed.base.toLowerCase().startsWith('wd') || parsed.base.toLowerCase().startsWith('nb');
      if (!isWideOrNb && extraLegal) legal += 1;
      score += parsed.runs + (isWideOrNb ? 1 : 0);
      if (parsed.wicket) {
        wicketNo += 1;
        const overs = Math.floor(legal / bpo);
        const balls = legal % bpo;
        if (fow[wicketNo - 1]) {
          fow[wicketNo - 1].overs = `${overs}.${balls}`;
          fow[wicketNo - 1].score = score;
        } else {
          fow.push({
            wicket: wicketNo,
            score,
            overs: `${overs}.${balls}`,
            batter: dismissed[wicketNo - 1]?.name || 'Batter',
          });
        }
      }
    });
  }

  return { partnerships: partners.slice(0, 10), fow };
}

export function buildOverBuckets(ballLog: string[], ballsPerOver = 6): OverBucket[] {
  const overs: OverBucket[] = [];
  let legal = 0;
  let current: OverBucket = { over: 1, runs: 0, wickets: 0, balls: [] };
  ballLog.forEach(raw => {
    const base = raw.split('→')[0];
    const parsed = parseBallLabel(base);
    const lower = parsed.base.toLowerCase();
    const isExtraDelivery = lower.startsWith('wd') || lower.startsWith('nb') || lower === 'rh';
    const runs = parsed.runs + (lower.startsWith('wd') || lower.startsWith('nb') ? 1 : 0);
    current.runs += parsed.wicket && lower === 'rh' ? 0 : runs;
    if (parsed.wicket && lower !== 'rh') current.wickets += 1;
    current.balls.push(raw);
    if (!isExtraDelivery) {
      legal += 1;
      if (legal >= ballsPerOver) {
        overs.push(current);
        current = { over: overs.length + 1, runs: 0, wickets: 0, balls: [] };
        legal = 0;
      }
    }
  });
  if (current.balls.length) overs.push(current);
  return overs;
}

export function buildWagonShots(ballLog: string[]): WagonShot[] {
  const byZone = new Map<string, WagonShot>();
  WAGON_ZONES.forEach(z => byZone.set(z, { zone: z, runs: 0, count: 0 }));
  ballLog.forEach(raw => {
    const zone = parseZoneFromLabel(raw);
    if (!zone) return;
    const parsed = parseBallLabel(raw.split('→')[0]);
    const current = byZone.get(zone) || { zone, runs: 0, count: 0 };
    current.runs += parsed.runs;
    current.count += 1;
    byZone.set(zone, current);
  });
  return Array.from(byZone.values());
}

export function cumulativeRuns(overs: OverBucket[]): number[] {
  let total = 0;
  return overs.map(o => {
    total += o.runs;
    return total;
  });
}
