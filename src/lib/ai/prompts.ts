// src/lib/ai/prompts.ts
// Prompt templates for AI narrative generation.
// Produces a 3-5 sentence plain-English digest of a repo's weekly health.

import type { ContributorSummary, RhythmFlag, BottleneckItem, ScoreSubSignals } from '@/types/index';

export interface NarrativeInput {
  repoName: string;           // "owner/repo"
  currentWeekScore: number;   // 0-100
  previousWeekScore: number | null;
  subScores: ScoreSubSignals;
  contributorRollups: ContributorSummary[];
  bottleneckAnalysis: BottleneckItem[];
  stalePRCount: number;
  weekStart: string;          // ISO date string
}

// The structured JSON we ask the AI to produce — makes parsing safe and consistent.
export interface NarrativeJsonOutput {
  narrative: string;  // 3-5 sentence plain-English digest
}

/**
 * Builds the system prompt for the AI narrative generator.
 * Returns a system-level instruction string.
 */
export function buildSystemPrompt(): string {
  return `You are an expert engineering team analyst. Your job is to produce concise, actionable
plain-English summaries of GitHub repository health metrics for engineering managers.

Rules:
- Output ONLY valid JSON with a single "narrative" key.
- The narrative must be exactly 3-5 sentences — no more, no less.
- Be specific: name real contributors, quote real numbers.
- Highlight the MOST important change this week (positive or negative).
- If there are contributor concerns (silent contributors, review drops), call them out by name.
- End with exactly ONE specific, actionable recommendation.
- Write for a non-technical engineering manager, not a developer.
- Do NOT use markdown formatting, bullet points, or headers inside the narrative.
- Keep a neutral, professional tone — no fluff, no filler.

Example output:
{"narrative": "Your team's review velocity dropped 38% this week, from a median of 8 hours to 13 hours to first review. Alice reviewed 0 PRs last week after averaging 4 per week — consider checking in with her or redistributing review load. Three PRs have been open for more than 7 days without activity, suggesting they may be blocked. Recommend scheduling a quick sync to identify which PRs need stakeholder decisions before they stall further."}`;
}

/**
 * Builds the user prompt with the actual weekly data.
 */
export function buildUserPrompt(input: NarrativeInput): string {
  const {
    repoName,
    currentWeekScore,
    previousWeekScore,
    subScores,
    contributorRollups,
    bottleneckAnalysis,
    stalePRCount,
    weekStart,
  } = input;

  const scoreDelta =
    previousWeekScore !== null
      ? currentWeekScore - previousWeekScore
      : null;

  const scoreDeltaStr =
    scoreDelta !== null
      ? `${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)} from last week (was ${previousWeekScore})`
      : 'no previous week to compare';

  // Format contributor rollups concisely
  const contributorLines = contributorRollups
    .slice(0, 10)
    .map((c) => {
      const flags = c.rhythm_flags.length > 0
        ? ` [FLAGS: ${c.rhythm_flags.map((f: RhythmFlag) => f.flag_type).join(', ')}]`
        : '';
      return `  - ${c.github_login}: ${c.total_prs_opened} PRs opened, ${c.total_reviews_given} reviews given, ${c.weeks_active} weeks active${flags}`;
    })
    .join('\n');

  // Format bottlenecks
  const bottleneckLines = bottleneckAnalysis
    .slice(0, 5)
    .map((b: BottleneckItem) =>
      `  - [${b.severity.toUpperCase()}] ${b.type}: ${b.description} (contributors: ${b.contributors_involved.join(', ')})`
    )
    .join('\n');

  return `Generate a health narrative for this repository. Return ONLY a JSON object with a "narrative" key.

REPOSITORY: ${repoName}
WEEK OF: ${weekStart}

OVERALL HEALTH SCORE: ${currentWeekScore}/100 (${scoreDeltaStr})

SUB-SCORES (0-100, higher is better):
  - Review Velocity: ${subScores.review_velocity}
  - Contributor Rhythm: ${subScores.contributor_rhythm}
  - Stale PR Burden: ${subScores.stale_pr_burden}
  - PR Size Discipline: ${subScores.pr_size_discipline}
  - Review Depth: ${subScores.review_depth}
  - Revert Rate: ${subScores.revert_rate}

STALE PRS (open > 7 days): ${stalePRCount}

CONTRIBUTORS THIS WEEK:
${contributorLines || '  (no contributor data)'}

BOTTLENECKS DETECTED:
${bottleneckLines || '  (none detected)'}

Now write the 3-5 sentence narrative. Remember: name specific contributors, quote real numbers, and end with one clear recommendation. Return ONLY JSON.`;
}
