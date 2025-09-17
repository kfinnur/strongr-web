import { useEffect, useMemo, useState, type ReactNode, type ButtonHTMLAttributes, type FormEvent } from "react";

/**
 * Fitness Registration + Leaderboards — Single-file React app (TypeScript)
 * -----------------------------------------------------------------------
 * Drop into any Vite React + TS project. Uses Tailwind for styling.
 *
 * FLOW
 * 1) Reads QR query params: event, device, country, time, t, nonce, sig, countryName, localDT
 * 2) Shows a registration form with read-only summary of Time • Country • Local Date/Time
 * 3) Submits to your backend POST /register (expects JSON response with rank + leaderboards)
 * 4) Displays Country Top 100 and Global Top 20 leaderboards
 */
const API_BASE = "https://lfmgpiaokicvdejzxxxr.supabase.co/functions/v1/api"; // Supabase Edge Function base URL

// ---------- Types ----------
export type LeaderboardRow = {
  id?: number;
  name: string;
  age?: number | null;
  gender?: string | null;
  country: string;
  time_seconds: number;
  created_at?: string;
  t_qr?: string;
};

export type MeRow = LeaderboardRow & {
  rank_country?: number;
  rank_global?: number;
};

// Utility: ordinals (1st, 2nd, 3rd, ...)
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  // @ts-ignore - small helper, safe for our use
  return String(n) + (s[(v - 20) % 10] || s[v] || s[0]);
}

function useQueryParams(): Record<string, string> {
  const [params] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search).entries()));
  return params as Record<string, string>;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <div className="text-sm uppercase tracking-widest text-gray-400">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
    </div>
  );
}

function Hero({ time, countryName, localDT, rankPreview }: { time: number; countryName?: string; localDT?: string; rankPreview?: number | null; }) {
  return (
    <div className="w-full rounded-3xl p-6 md:p-10 bg-gradient-to-br from-zinc-900/80 to-zinc-800/80 border border-white/10 shadow-xl">
      <h1 className="text-3xl md:text-5xl font-bold text-white text-center">Register Your Result</h1>
      <p className="mt-3 text-center text-zinc-300">Strong today, stronger tomorrow.</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Your Time" value={`${Number(time).toFixed(2)} sec`} />
        <Stat label="Location" value={countryName || "—"} />
        <Stat label="Date & Time" value={localDT || "—"} />
      </div>

      {typeof rankPreview === "number" && (
        <div className="mt-4 text-center text-lime-400">Estimated rank: {ordinal(rankPreview)}</div>
      )}
    </div>
  );
}

function Input({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold bg-lime-500 hover:bg-lime-400 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-900 shadow ${className}`}
    >
      {children}
    </button>
  );
}

function Table({ title, rows, highlight }: { title: string; rows: LeaderboardRow[]; highlight?: LeaderboardRow | null; }) {
  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 text-white font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-zinc-300 text-sm">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Time (s)</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Age</th>
              <th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">Country</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows?.map((r, idx) => {
              const isYou = !!highlight && highlight.name === r.name && highlight.time_seconds === r.time_seconds && highlight.country === r.country;
              return (
                <tr key={r.id ?? `${r.country}-${idx}`} className={isYou ? "bg-lime-500/10" : ""}>
                  <td className="px-4 py-2 text-zinc-200">{idx + 1}</td>
                  <td className="px-4 py-2 text-zinc-100 font-medium">{Number(r.time_seconds).toFixed(2)}</td>
                  <td className="px-4 py-2 text-white font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-zinc-200">{r.age ?? ""}</td>
                  <td className="px-4 py-2 text-zinc-200">{r.gender ?? ""}</td>
                  <td className="px-4 py-2 text-zinc-200">{r.country}</td>
                  <td className="px-4 py-2 text-zinc-400">{new Date((r.created_at ?? r.t_qr) ?? Date.now()).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  const qp = useQueryParams();
  const [step, setStep] = useState<"form" | "leaderboards">("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rankPreview, setRankPreview] = useState<number | null>(null);

  const [form, setForm] = useState<{ name: string; age: string; gender: string }>({ name: "", age: "", gender: "" });

  const [me, setMe] = useState<MeRow | null>(null); // record returned by backend
  const [lbCountry, setLbCountry] = useState<LeaderboardRow[]>([]);
  const [lbGlobal, setLbGlobal] = useState<LeaderboardRow[]>([]);

  const countryCode = qp.country || "";
  const countryName = qp.countryName || qp.country || "";
  const timeSec = useMemo(() => Number(qp.time || 0), [qp.time]);

  // Optional: show estimated rank before submit
  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        const url = `${API_BASE}/rank_preview?country=${encodeURIComponent(countryCode)}&time=${encodeURIComponent(timeSec)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { rank?: number };
        if (!ignore && typeof data.rank === "number") setRankPreview(data.rank);
      } catch {
        /* ignore */
      }
    }
    if (countryCode && timeSec > 0) run();
    return () => {
      ignore = true;
    };
  }, [countryCode, timeSec]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        // trusted fields from QR
        event: qp.event,
        device: qp.device,
        country: qp.country,
        time: qp.time,
        t: qp.t,
        nonce: qp.nonce,
        sig: qp.sig,
        // user fields
        name: form.name?.trim(),
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
      };
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to register");
      }
      const data = (await res.json()) as {
        me: MeRow;
        leaderboard_country: LeaderboardRow[];
        leaderboard_global: LeaderboardRow[];
      };
      setMe(data.me);
      setLbCountry(data.leaderboard_country || []);
      setLbGlobal(data.leaderboard_global || []);
      setStep("leaderboards");
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-950 via-zinc-900 to-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header / brand */}
        <header className="flex items-center justify-between">
          <div className="text-2xl font-black tracking-tight">
            STRONG<span className="text-lime-400">•</span>R
          </div>
          <div className="text-xs md:text-sm text-zinc-400">Move more. Grip harder. Live better.</div>
        </header>

        {/* HERO & FORM */}
        {step === "form" && (
          <>
            <div className="mt-8">
              <Hero time={timeSec} countryName={countryName} localDT={qp.localDT} rankPreview={rankPreview ?? undefined} />
            </div>

            <form onSubmit={onSubmit} className="mt-8 grid gap-6 bg-zinc-900/60 border border-white/10 rounded-3xl p-6 md:p-8">
              <h2 className="text-xl font-semibold">Tell us who you are</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Input label="Name (required)">
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-white/10 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
                    placeholder="Your name"
                  />
                </Input>
                <Input label="Age">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-white/10 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
                    placeholder="30"
                  />
                </Input>
                <Input label="Gender">
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </Input>
              </div>

              {error && <div className="text-red-400 text-sm">{error}</div>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submitting}> {submitting ? "Submitting…" : "Submit result"} </Button>
                <div className="text-xs text-zinc-400">By submitting you agree to appear on the public leaderboard.</div>
              </div>
            </form>

            {/* Motivational strip */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-lime-500/10 to-lime-400/0 border border-lime-500/20">Train smart. Lift safe.</div>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-400/0 border border-cyan-500/20">Grip is the gateway to strength.</div>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-400/0 border border-fuchsia-500/20">Consistency beats intensity.</div>
            </div>
          </>
        )}

        {/* LEADERBOARDS */}
        {step === "leaderboards" && (
          <div className="mt-8 space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold">You're in! 💪</h2>
              {me?.rank_country && (
                <p className="text-zinc-300 mt-2">Your country rank: <span className="text-white font-semibold">{ordinal(me.rank_country)}</span></p>
              )}
              {me?.rank_global && (
                <p className="text-zinc-300">Global rank: <span className="text-white font-semibold">{ordinal(me.rank_global)}</span></p>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Table title={`Top 100 — ${countryName}`} rows={lbCountry} highlight={me} />
              <Table title="Top 20 — Global" rows={lbGlobal} highlight={me} />
            </div>

            <div className="mt-8 text-center text-zinc-400">
              Keep training. Come back stronger. Share your score with #StrongR
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-zinc-500">© {new Date().getFullYear()} StrongR • Built for the love of strength.</footer>
      </div>

      {/* Background hero image (subtle) */}
      <div className="fixed inset-0 -z-10 opacity-10 bg-[url('https://images.unsplash.com/photo-1571019613914-85f342c65dc8?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
    </div>
  );
}
