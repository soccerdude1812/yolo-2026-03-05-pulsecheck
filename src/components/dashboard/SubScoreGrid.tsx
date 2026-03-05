'use client';

import { SubScoreMiniCard } from './ScoreCard';
import type { WeeklyHealthScore } from '@/types/index';
import { SCORING_WEIGHTS } from '@/lib/scoring/config';

interface SubScoreGridProps {
  score: WeeklyHealthScore | null;
}

export function SubScoreGrid({ score }: SubScoreGridProps) {
  const subScores = score
    ? [
        {
          label: 'Review Velocity',
          score: score.sub_score_review_velocity,
          weight: SCORING_WEIGHTS.review_velocity,
        },
        {
          label: 'Contributor Rhythm',
          score: score.sub_score_contributor_rhythm,
          weight: SCORING_WEIGHTS.contributor_rhythm,
        },
        {
          label: 'Stale PRs',
          score: score.sub_score_stale_pr_burden,
          weight: SCORING_WEIGHTS.stale_pr_burden,
        },
        {
          label: 'PR Size Discipline',
          score: score.sub_score_pr_size_discipline,
          weight: SCORING_WEIGHTS.pr_size_discipline,
        },
        {
          label: 'Review Depth',
          score: score.sub_score_review_depth,
          weight: SCORING_WEIGHTS.review_depth,
        },
        {
          label: 'Revert Rate',
          score: score.sub_score_revert_rate,
          weight: SCORING_WEIGHTS.revert_rate,
        },
      ]
    : Array.from({ length: 6 }, () => ({ label: '—', score: null, weight: undefined }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {subScores.map((sub, i) => (
        <SubScoreMiniCard
          key={score ? sub.label : i}
          label={sub.label}
          score={sub.score}
          weight={sub.weight}
        />
      ))}
    </div>
  );
}
