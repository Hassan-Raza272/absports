import { Share } from 'react-native';
import { Match, Player, PointsTableEntry, Tournament } from '../types';

export async function shareText(title: string, message: string) {
  try {
    await Share.share({ title, message });
  } catch {
    // User cancelled or share sheet unavailable.
  }
}

export function matchShareMessage(match: Match, clubName?: string): string {
  const inn1 = match.innings?.first;
  const inn2 = match.innings?.second;
  const lines = [
    `AB Sports${clubName ? ` · ${clubName}` : ''}`,
    '════════════════════',
    `${match.teamAName} vs ${match.teamBName}`,
    match.tournamentId ? `Match ${match.matchNumber}${match.stage ? ` · ${match.stage}` : ''}` : 'Friendly match',
    `${match.venue || 'Ground'} · ${match.dateTime ? new Date(match.dateTime).toLocaleString() : ''}`,
    '────────────────────',
  ];
  if (inn1) {
    const bat = inn1.battingTeam === match.teamB ? match.teamBName : match.teamAName;
    lines.push(`${bat}`);
    lines.push(`  ${inn1.runs}/${inn1.wickets} (${inn1.overs}.${inn1.balls} ov)`);
    (inn1.batting || []).slice(0, 11).forEach(b => {
      lines.push(`  ${b.name}  ${b.runs}(${b.balls})${b.out ? `  ${b.out}` : '  not out'}`);
    });
  }
  if (inn2) {
    const bat = inn2.battingTeam === match.teamB ? match.teamBName : match.teamAName;
    lines.push('────────────────────');
    lines.push(`${bat}`);
    lines.push(`  ${inn2.runs}/${inn2.wickets} (${inn2.overs}.${inn2.balls} ov)`);
    (inn2.batting || []).slice(0, 11).forEach(b => {
      lines.push(`  ${b.name}  ${b.runs}(${b.balls})${b.out ? `  ${b.out}` : '  not out'}`);
    });
  }
  if (match.result) lines.push('────────────────────', match.result);
  if (match.playerOfMatch) lines.push(`PoM: ${match.playerOfMatch}`);
  lines.push('════════════════════', 'Scored on AB Sports');
  return lines.join('\n');
}

/** Rich standings block suitable for image-style social share (monospace-friendly). */
export function pointsTableImageStyleMessage(
  tournament: Tournament | undefined,
  entries: PointsTableEntry[],
  clubName?: string,
): string {
  const header = `AB Sports · ${clubName || ''} · ${tournament?.name || 'Table'}`.trim();
  const cols = ['#', 'Team', 'P', 'W', 'L', 'NR', 'NRR', 'Pts'];
  const body = entries.map((e, i) =>
    [
      String(i + 1).padStart(2),
      e.shortName.padEnd(4).slice(0, 4),
      String(e.played).padStart(2),
      String(e.won).padStart(2),
      String(e.lost).padStart(2),
      String(e.nr).padStart(2),
      `${e.nrr >= 0 ? '+' : ''}${e.nrr.toFixed(2)}`.padStart(6),
      String(e.points).padStart(3),
    ].join(' '),
  );
  return [header, cols.join('  '), '─'.repeat(28), ...body, 'Powered by AB Sports'].join('\n');
}

export function pointsTableShareMessage(tournament: Tournament | undefined, entries: PointsTableEntry[], clubName?: string): string {
  const header = `AB Sports points · ${clubName || ''} ${tournament?.name || ''}`.trim();
  const rows = entries.map((e, i) => `${i + 1}. ${e.shortName}  P${e.played} W${e.won} L${e.lost}  ${e.nrr >= 0 ? '+' : ''}${e.nrr.toFixed(2)}  ${e.points}pts`);
  return [header, ...rows, 'Powered by AB Sports'].join('\n');
}

export function playerShareMessage(player: Player): string {
  return [
    `${player.name} · #${player.jerseyNumber} · ${player.role}`,
    player.teamName,
    `Bat: ${player.battingStats.runs} runs · Avg ${player.battingStats.average.toFixed(1)} · SR ${player.battingStats.strikeRate.toFixed(1)}`,
    `Bowl: ${player.bowlingStats.wickets} wkts · Eco ${player.bowlingStats.economy.toFixed(2)} · Best ${player.bowlingStats.bestFigures}`,
    'AB Sports player profile',
  ].join('\n');
}
