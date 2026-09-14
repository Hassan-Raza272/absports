export type CommentaryBall = {
  over: number;
  ball: number;
  label: string;
  runs: number;
  extra: boolean;
  wicket: boolean;
  desc: string;
  bowler?: string;
  batsman?: string;
};

/** Parse a live scoring ballLog label into structured commentary fields. */
export function parseBallLabel(raw: string): {
  base: string;
  zone?: string;
  runs: number;
  wicket: boolean;
  extra: boolean;
  isLegalDelivery: boolean;
  desc: string;
} {
  const [basePart, zone] = raw.split('→');
  const base = (basePart || raw).trim();
  const lower = base.toLowerCase();

  // Order matters: "wd" also starts with "w", so detect wides before wickets.
  const isWide = lower.startsWith('wd');
  const isNoBall = lower.startsWith('nb');
  const isLegBye = lower.startsWith('lb');
  const isBye = /^b\d*$/i.test(base) || (lower.startsWith('b') && !isWide && !isLegBye && !/^bowled/i.test(lower));
  const isRetiredHurt = lower === 'rh';
  const wicket = !isWide && (/^w$/i.test(base) || /^w\+\d+/i.test(base));
  const extra = isWide || isNoBall || isBye || isLegBye;

  let runs = 0;
  if (isWide) {
    const m = base.match(/wd(\d*)/i);
    runs = m && m[1] ? Number(m[1]) : 0;
  } else if (wicket) {
    const plus = base.match(/w\+(\d+)/i);
    runs = plus ? Number(plus[1]) : 0;
  } else if (isNoBall) {
    const m = base.match(/nb\+(\d+)/i);
    runs = m ? Number(m[1]) : 0;
  } else if (isBye) {
    const m = base.match(/^b(\d+)/i);
    runs = m ? Number(m[1]) : 0;
  } else if (isLegBye) {
    const m = base.match(/^lb(\d+)/i);
    runs = m ? Number(m[1]) : 0;
  } else if (!isRetiredHurt) {
    runs = Number(base) || 0;
  }

  // Legal balls advance the over; wides/no-balls/retire-hurt do not.
  const isLegalDelivery = !isWide && !isNoBall && !isRetiredHurt;

  let desc = '';
  if (isRetiredHurt) desc = 'Batter retired hurt.';
  else if (isWide) desc = runs > 0 ? `Wide, ${runs} extra run(s).` : 'Wide ball.';
  else if (wicket) desc = runs > 0 ? `Wicket! ${runs} run(s) completed.` : 'Wicket!';
  else if (isNoBall) desc = runs > 0 ? `No ball, ${runs} run(s) off the bat.` : 'No ball.';
  else if (isBye) desc = `${runs} bye${runs === 1 ? '' : 's'}.`;
  else if (isLegBye) desc = `${runs} leg bye${runs === 1 ? '' : 's'}.`;
  else if (runs === 6) desc = 'Six!';
  else if (runs === 4) desc = 'Four!';
  else if (runs === 0) desc = 'Dot ball.';
  else desc = `${runs} run${runs === 1 ? '' : 's'}.`;

  if (zone) desc = `${desc} Shot towards ${zone}.`;

  return { base, zone, runs, wicket, extra, isLegalDelivery, desc };
}

/**
 * Rebuild ball-by-ball commentary with correct over.ball numbering
 * from the persisted live scoring ballLog.
 */
export function buildCommentaryFromBallLog(
  ballLog: string[] = [],
  meta?: { bowler?: string; batsman?: string },
): CommentaryBall[] {
  let completedOvers = 0;
  let ballsInOver = 0;
  const out: CommentaryBall[] = [];

  ballLog.forEach(raw => {
    const parsed = parseBallLabel(raw);
    const over = completedOvers;
    // Non-counting deliveries still show against the upcoming ball slot
    // (e.g. wide on 3.2 before the legal 3.2 is completed).
    const ball = Math.min(ballsInOver + 1, 6);

    out.push({
      over,
      ball,
      label: raw,
      runs: parsed.runs,
      extra: parsed.extra,
      wicket: parsed.wicket,
      desc: parsed.desc,
      bowler: meta?.bowler,
      batsman: meta?.batsman,
    });

    if (parsed.isLegalDelivery) {
      ballsInOver += 1;
      if (ballsInOver >= 6) {
        completedOvers += 1;
        ballsInOver = 0;
      }
    }
  });

  return out;
}

/** Spoken score summary for voice commentary. */
export function buildMatchVoiceSummary(input: {
  status: string;
  teamAName: string;
  teamBName: string;
  firstTeamName: string;
  secondTeamName: string;
  inn1?: { runs: number; wickets: number; overs: number; balls: number } | null;
  inn2?: { runs: number; wickets: number; overs: number; balls: number } | null;
  currentInnings?: 1 | 2;
  result?: string;
  oversLimit: number;
  strikerName?: string;
  strikerRuns?: number;
  nonStrikerName?: string;
  nonStrikerRuns?: number;
  bowlerName?: string;
}): string {
  const parts: string[] = [];
  if (input.inn1) {
    parts.push(
      `${input.firstTeamName} scored ${input.inn1.runs} for ${input.inn1.wickets} in ${input.inn1.overs}.${input.inn1.balls} overs.`,
    );
  }
  if (input.inn2) {
    parts.push(
      `${input.secondTeamName} are ${input.inn2.runs} for ${input.inn2.wickets} in ${input.inn2.overs}.${input.inn2.balls} overs.`,
    );
  } else if (input.currentInnings === 2 && input.inn1) {
    const target = input.inn1.runs + 1;
    parts.push(`${input.secondTeamName} need ${target} to win.`);
  }

  if (input.status === 'LIVE' && input.currentInnings === 2 && input.inn1 && input.inn2) {
    const target = input.inn1.runs + 1;
    const needed = Math.max(0, target - input.inn2.runs);
    const ballsLeft = Math.max(
      0,
      input.oversLimit * 6 - (input.inn2.overs * 6 + input.inn2.balls),
    );
    parts.push(`They need ${needed} runs from ${ballsLeft} balls.`);
  }

  if (input.strikerName) {
    parts.push(
      `${input.strikerName} is on strike on ${input.strikerRuns ?? 0}. ${input.nonStrikerName || 'The non-striker'} is on ${input.nonStrikerRuns ?? 0}.`,
    );
  }
  if (input.bowlerName) {
    parts.push(`${input.bowlerName} is bowling.`);
  }
  if (input.result && !String(input.result).startsWith('Target:')) {
    parts.push(input.result);
  }
  if (parts.length === 0) {
    return `${input.teamAName} versus ${input.teamBName}. Match updates will begin once scoring starts.`;
  }
  return parts.join(' ');
}
