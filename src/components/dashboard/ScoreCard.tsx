'use client';

interface ScoreCardProps {
  score: number | null;
  prevScore?: number | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
}

function getScoreColor(score: number): { text: string; bg: string; ring: string; bar: string } {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/30', bar: 'bg-emerald-500' };
  if (score >= 60) return { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'border-amber-500/30', bar: 'bg-amber-500' };
  return { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'border-rose-500/30', bar: 'bg-rose-500' };
}

export function ScoreCard({ score, prevScore, label = 'Health Score', size = 'lg', showTrend = true }: ScoreCardProps) {
  if (score === null || score === undefined) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-zinc-600 text-5xl font-bold">--</div>
        <div className="text-xs text-zinc-500 mt-2 uppercase tracking-wider">{label}</div>
      </div>
    );
  }

  const colors = getScoreColor(score);
  const delta = prevScore != null ? score - prevScore : null;
  const isLarge = size === 'lg';

  return (
    <div className="flex flex-col items-center">
      {/* Circular score display */}
      <div className={`relative flex items-center justify-center rounded-full border-4 ${colors.ring} ${colors.bg} ${isLarge ? 'w-36 h-36' : 'w-20 h-20'} animate-score-pop`}>
        <div className="text-center">
          <div className={`font-bold tabular-nums leading-none ${isLarge ? `text-5xl ${colors.text}` : `text-3xl ${colors.text}`}`}>
            {Math.round(score)}
          </div>
          {isLarge && <div className="text-xs text-zinc-500 mt-1">/100</div>}
        </div>
      </div>

      {/* Label */}
      <div className={`text-zinc-400 uppercase tracking-wider font-medium mt-3 ${isLarge ? 'text-xs' : 'text-[10px]'}`}>
        {label}
      </div>

      {/* Trend */}
      {showTrend && delta !== null && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
          {delta > 0 ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          ) : delta < 0 ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
            </svg>
          )}
          {delta > 0 ? `+${delta.toFixed(0)}` : delta < 0 ? delta.toFixed(0) : 'No change'} from last week
        </div>
      )}
    </div>
  );
}

interface SubScoreMiniCardProps {
  label: string;
  score: number | null;
  weight?: number;
}

export function SubScoreMiniCard({ label, score, weight }: SubScoreMiniCardProps) {
  if (score === null || score === undefined) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{label}</div>
        <div className="h-1.5 bg-zinc-800 rounded-full mt-3" />
      </div>
    );
  }

  const colors = getScoreColor(score);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-zinc-500 uppercase tracking-wider leading-tight">{label}</div>
        {weight != null && (
          <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
            {Math.round(weight * 100)}%
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${colors.text}`}>
        {Math.round(score)}
      </div>
      <div className="mt-2.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
