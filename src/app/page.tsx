export const dynamic = 'force-dynamic';

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Composite Health Score',
    description: 'A single 0–100 score computed from 6 weighted signals: review velocity, contributor rhythm, stale PRs, PR size discipline, review depth, and revert rate.',
    accent: 'emerald',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: 'Bottleneck Analysis',
    description: 'Automatically detect review concentration (one person reviewing everything), slow-lane authors, and PR size antipatterns that are holding your team back.',
    accent: 'amber',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Contributor Rhythm',
    description: 'Detect when contributors go silent, experience review drops, or shift to unusually large PRs — before it becomes a team-wide morale or retention problem.',
    accent: 'emerald',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI Narrative Digest',
    description: 'Every week, an AI writes a plain-English summary of what changed in your engineering process and why — no more interpreting charts alone. Free users get 1/month.',
    accent: 'emerald',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Stale PR Tracker',
    description: 'See every open PR that has been sitting for more than 7 days with direct links to GitHub. Stop losing good work in the review queue.',
    accent: 'rose',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: 'Smart Alerts',
    description: 'Get notified via Slack or email when your health score drops more than N points in consecutive weeks. Catch the slowdown before it becomes a crisis.',
    accent: 'amber',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'For individual contributors monitoring one repo.',
    cta: 'Start Free',
    ctaLink: '/api/auth/github',
    highlighted: false,
    features: [
      { text: '1 GitHub repo', included: true },
      { text: '4 weeks of history', included: true },
      { text: 'Health score + trend chart', included: true },
      { text: 'Stale PR tracker', included: true },
      { text: '1 AI narrative per month', included: true },
      { text: 'Bottleneck analysis', included: true },
      { text: 'Manual sync only', included: true },
      { text: 'Slack / email alerts', included: false },
      { text: 'Contributor deep-dive', included: false },
      { text: 'Up to 5 repos', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    description: 'For engineering leads tracking multiple repos.',
    cta: 'Get Pro',
    ctaLink: '/api/auth/github',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      { text: 'Up to 5 GitHub repos', included: true },
      { text: '26 weeks of history', included: true },
      { text: 'Health score + trend chart', included: true },
      { text: 'Stale PR tracker', included: true },
      { text: 'Unlimited AI narratives', included: true },
      { text: 'Bottleneck analysis', included: true },
      { text: 'Auto-sync (nightly)', included: true },
      { text: 'Slack + email alerts', included: true },
      { text: 'Contributor deep-dive (52 weeks)', included: true },
      { text: 'CSV export', included: false },
    ],
  },
  {
    name: 'Team',
    price: '$29',
    period: '/month',
    description: 'For engineering managers with large org oversight.',
    cta: 'Get Team',
    ctaLink: '/api/auth/github',
    highlighted: false,
    features: [
      { text: 'Unlimited GitHub repos', included: true },
      { text: '52 weeks of history', included: true },
      { text: 'Health score + trend chart', included: true },
      { text: 'Stale PR tracker', included: true },
      { text: 'Unlimited AI narratives', included: true },
      { text: 'Bottleneck analysis', included: true },
      { text: 'Auto-sync (nightly)', included: true },
      { text: 'Slack + email alerts', included: true },
      { text: 'Contributor deep-dive (52 weeks)', included: true },
      { text: 'CSV export', included: true },
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-50 text-lg tracking-tight">PulseCheck</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors hidden sm:block">
              Features
            </a>
            <a href="#pricing" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors hidden sm:block">
              Pricing
            </a>
            <a
              href="/api/auth/github"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Connect GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px]" />
          <div className="absolute top-32 left-1/4 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Now tracking 90 days of PR history from day one
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-zinc-50 leading-tight tracking-tight mb-6 animate-fade-in delay-100">
            Know your team&apos;s{' '}
            <span className="text-emerald-400">engineering health</span>
            {' '}before it&apos;s too late
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in delay-200">
            PulseCheck connects to your GitHub repos and gives you a weekly health score across review velocity, contributor rhythm, bottlenecks, and more — with an AI digest that explains what changed and why.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in delay-300">
            <a
              href="/api/auth/github"
              className="inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Connect GitHub — It&apos;s Free
            </a>
            <a href="#features" className="text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2">
              See how it works
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-zinc-500 animate-fade-in delay-400">
            Free forever · No credit card required · 90 days of history from minute one
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-5xl mx-auto mt-16 animate-fade-in delay-500">
          <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
            {/* Fake topbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
              <div className="w-3 h-3 rounded-full bg-rose-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber-500/50" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
              <div className="ml-4 text-xs text-zinc-500 font-mono">PulseCheck Dashboard</div>
            </div>
            {/* Score preview */}
            <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 flex flex-col items-center justify-center p-6 bg-zinc-900 rounded-xl border border-zinc-800">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Health Score</div>
                <div className="text-7xl font-bold text-emerald-400 tabular-nums">84</div>
                <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  +3 from last week
                </div>
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Review Velocity', score: 91, color: 'emerald' },
                  { label: 'Contributor Rhythm', score: 78, color: 'amber' },
                  { label: 'Stale PRs', score: 85, color: 'emerald' },
                  { label: 'PR Size', score: 72, color: 'amber' },
                  { label: 'Review Depth', score: 88, color: 'emerald' },
                  { label: 'Revert Rate', score: 95, color: 'emerald' },
                ].map((item) => (
                  <div key={item.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">{item.label}</div>
                    <div className={`text-2xl font-bold ${item.color === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {item.score}
                    </div>
                    <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-4">
              Everything your team needs to stay healthy
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Six signals. One score. Weekly AI insight. Stop guessing whether your engineering process is working.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-700 transition-all hover:-translate-y-0.5"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  feature.accent === 'emerald'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : feature.accent === 'amber'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-zinc-50 text-lg mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-4">
              Up and running in 60 seconds
            </h2>
            <p className="text-zinc-400 text-lg">No complex setup. No YAML. Just GitHub OAuth.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect GitHub',
                description: 'Sign in with GitHub OAuth. We only read your repo data — we never write or modify anything.',
              },
              {
                step: '02',
                title: 'Add a repo',
                description: 'Type your repo name or browse your repos. We immediately fetch 90 days of PR history.',
              },
              {
                step: '03',
                title: 'See your health score',
                description: 'A fully populated dashboard appears with 12 weeks of trend data, contributor heatmap, and bottleneck analysis.',
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-6xl font-bold text-zinc-800 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-zinc-50 mb-2">{item.title}</h3>
                <p className="text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-400 text-lg">
              Free forever for one repo. Upgrade when your team grows.
            </p>
            <p className="text-sm text-emerald-400 mt-2">
              Free users get 1 AI narrative/month. Pro unlocks unlimited.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-semibold text-zinc-50 text-xl mb-1">{plan.name}</h3>
                  <p className="text-zinc-400 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-zinc-50">{plan.price}</span>
                    <span className="text-zinc-500 mb-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-3 text-sm">
                      {feature.included ? (
                        <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-zinc-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={feature.included ? 'text-zinc-300' : 'text-zinc-600'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.ctaLink}
                  className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlighted
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-3xl border border-zinc-800 p-12 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-emerald-500/10 rounded-full blur-[60px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-4">
                Start tracking your team&apos;s health today
              </h2>
              <p className="text-zinc-400 text-lg mb-8">
                Connect your first repo in 60 seconds. No credit card. No installation.
                Just clear, actionable engineering insights.
              </p>
              <a
                href="/api/auth/github"
                className="inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                Connect GitHub — It&apos;s Free
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-400">PulseCheck</span>
          </div>
          <p className="text-sm text-zinc-600">
            &copy; {new Date().getFullYear()} PulseCheck. Engineering health, automated.
          </p>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
