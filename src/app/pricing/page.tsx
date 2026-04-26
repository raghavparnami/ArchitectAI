import Link from 'next/link';
import { Check, Hexagon, ArrowRight, Sparkles } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For solo tinkerers',
    price: '$0',
    cadence: 'forever',
    features: [
      '3 diagrams',
      '3 AI generations / month',
      '1 user',
      'Community support',
      'Export to PNG',
    ],
    cta: 'Start free',
    href: '/sign-up',
    accent: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For independent architects',
    price: '$19',
    cadence: '/ month',
    features: [
      'Unlimited diagrams',
      'Unlimited AI generations',
      'Version history',
      'Email support',
      'Export to SVG, PNG, JSON',
      'Custom themes',
    ],
    cta: 'Upgrade to Pro',
    href: '/sign-up?plan=pro',
    accent: true,
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'For engineering teams',
    price: '$49',
    cadence: '/ user / month',
    features: [
      'Everything in Pro',
      'Up to 10 seats',
      'Approval workflows',
      'Comments & reviews',
      'Slack & Linear integrations',
      'Shared component library',
    ],
    cta: 'Start team trial',
    href: '/sign-up?plan=team',
    accent: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For organizations at scale',
    price: 'Custom',
    cadence: '',
    features: [
      'Everything in Team',
      'Unlimited seats',
      'SSO + SAML',
      'Custom AI instructions',
      'Audit logs + RBAC',
      'SLA + dedicated support',
      'On-prem deployment',
    ],
    cta: 'Contact sales',
    href: 'mailto:sales@architectai.dev',
    accent: false,
  },
];

const FAQS = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes — upgrade or downgrade at any time. You\u2019ll be billed on a pro-rated basis.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan never asks for payment details. You can upgrade whenever you\u2019re ready.',
  },
  {
    q: 'What happens to my diagrams if I cancel?',
    a: 'Your diagrams are exported automatically and remain available read-only for 90 days after cancellation.',
  },
  {
    q: 'Is my data used to train AI models?',
    a: 'No. Your prompts and diagrams are never used to train Gemini or any other model.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Top nav */}
      <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Hexagon size={20} className="text-[var(--accent)]" strokeWidth={2.5} />
          <span className="font-semibold tracking-tight">ArchitectAI</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            Home
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90"
          >
            Get started
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--hairline)] bg-white text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] mb-6">
          <Sparkles size={10} className="text-[var(--accent)]" />
          Simple, transparent pricing
        </div>
        <h1 className="font-display text-6xl md:text-7xl leading-[0.95] mb-5">
          Pricing for{' '}
          <span className="font-display-italic text-[var(--accent)]">every</span>{' '}
          team
        </h1>
        <p className="text-base text-[var(--muted)] max-w-xl mx-auto leading-relaxed">
          Start free. Upgrade when your team is ready. No credit card required.
        </p>
      </section>

      {/* Plans grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={
                p.accent
                  ? 'relative rounded-2xl border-2 border-[var(--accent)] bg-white p-6 shadow-[0_8px_24px_rgba(199,82,27,0.08)]'
                  : 'rounded-2xl border border-[var(--hairline)] bg-white p-6'
              }
            >
              {p.accent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                  Most popular
                </div>
              )}
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                {p.tagline}
              </div>
              <h3 className="font-display text-3xl mb-3">{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-5 tnum">
                <span className="font-display text-4xl">{p.price}</span>
                {p.cadence && (
                  <span className="text-xs text-[var(--muted)]">{p.cadence}</span>
                )}
              </div>
              <Link
                href={p.href}
                className={
                  p.accent
                    ? 'block text-center w-full mb-5 px-4 h-10 leading-10 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90'
                    : 'block text-center w-full mb-5 px-4 h-10 leading-10 rounded-md border border-[var(--foreground)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--foreground)] hover:text-[var(--background)] transition'
                }
              >
                {p.cta}
              </Link>
              <ul className="space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[var(--foreground)]">
                    <Check
                      size={12}
                      className={p.accent ? 'text-[var(--accent)] mt-0.5 shrink-0' : 'text-[var(--muted)] mt-0.5 shrink-0'}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
            Questions
          </div>
          <h2 className="font-display text-4xl">
            Frequently <span className="font-display-italic">asked</span>
          </h2>
        </div>
        <div className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
                <h3 className="text-sm font-semibold pr-4">{f.q}</h3>
                <span className="text-[var(--muted)] text-xl leading-none group-open:rotate-45 transition mt-0.5">
                  +
                </span>
              </summary>
              <p className="text-sm text-[var(--muted)] leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-[var(--foreground)] text-[var(--background)] p-12 text-center">
          <h2 className="font-display text-4xl mb-3">
            Start designing in <span className="font-display-italic text-[var(--accent)]">seconds</span>
          </h2>
          <p className="text-sm opacity-70 mb-6 max-w-md mx-auto">
            Generate your first AI-powered architecture diagram on the free plan.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 px-5 h-11 rounded-md bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90"
          >
            Get started free
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[11px] text-[var(--muted)] font-mono">
          <span>© 2026 ArchitectAI</span>
          <div className="flex gap-5">
            <Link href="/">Home</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
