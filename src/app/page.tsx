import Link from 'next/link';
import { Hexagon, ArrowRight, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-paper">
      <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Hexagon size={20} className="text-[var(--accent)]" strokeWidth={2.5} />
          <span className="font-semibold tracking-tight">ArchitectAI</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            Pricing
          </Link>
          {/* DEMO BYPASS — Sign in / Sign up links hidden so the demo lands
              straight in the app. Restore by uncommenting below. */}
          {/* <Link href="/sign-in" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            Sign in
          </Link> */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90"
          >
            Open app
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--hairline)] bg-white text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] mb-8">
          <Sparkles size={10} className="text-[var(--accent)]" />
          Powered by Gemini 2.5 Pro
        </div>
        <h1 className="font-display text-7xl md:text-8xl leading-[0.92] mb-6">
          Design architecture
          <br />
          <span className="font-display-italic text-[var(--accent)]">with AI</span>.
        </h1>
        <p className="text-base md:text-lg text-[var(--muted)] max-w-xl mx-auto leading-relaxed mb-10">
          Describe your problem, pick your stack, and ship a reviewable diagram in seconds.
          Built for engineering teams who think in systems.
        </p>
        <div className="flex items-center justify-center gap-3">
          {/* DEMO BYPASS — was href="/sign-up". Repointed to /dashboard. */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-5 h-11 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold hover:opacity-90"
          >
            Open app
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 px-5 h-11 rounded-md border border-[var(--foreground)] text-sm font-semibold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            See pricing
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)] py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[11px] text-[var(--muted)] font-mono">
          <span>© 2026 ArchitectAI</span>
          <div className="flex gap-5">
            <Link href="/pricing">Pricing</Link>
            {/* DEMO BYPASS — Sign in link hidden. */}
            {/* <Link href="/sign-in">Sign in</Link> */}
          </div>
        </div>
      </footer>
    </main>
  );
}
