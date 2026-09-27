import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FlaskConical,
  Gauge,
  HeartPulse,
  Info,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  TimerReset,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  getGetInsightsQueryKey,
  getGetPatientQueryKey,
  getGetPatientsQueryKey,
  useAcknowledgeAlert,
  useFastForwardSimulation,
  useGetInsights,
  useGetPatient,
  useGetPatients,
  useTickSimulation,
  type Alert,
  type PatientDetail,
  type PatientSummary,
  type RiskScore,
  type VitalReading,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

type RiskLevel = 'stable' | 'watch' | 'warning' | 'critical';
type SortKey = 'risk' | 'updated';

const riskMeta: Record<RiskLevel, { label: string; tone: string; dot: string }> = {
  stable: { label: 'Stable', tone: 'risk-stable', dot: 'bg-emerald-600' },
  watch: { label: 'Watch', tone: 'risk-watch', dot: 'bg-teal-700' },
  warning: { label: 'Warning', tone: 'risk-warning', dot: 'bg-amber-500' },
  critical: { label: 'Critical', tone: 'risk-critical', dot: 'bg-red-600' },
};

function timeLabel(date?: string) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

function dateLabel(date?: string) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function relativeTime(date?: string) {
  if (!date) return 'No update';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function percent(value?: number) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
}

function RiskBadge({ level, compact = false }: { level?: string; compact?: boolean }) {
  const safeLevel = (level || 'stable') as RiskLevel;
  const meta = riskMeta[safeLevel] || riskMeta.stable;
  return (
    <span data-testid={`status-risk-${safeLevel}`} className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[.11em] ${meta.tone} ${compact ? 'rounded-md' : 'rounded-full'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function MiniSparkline({ trend, color = 'currentColor' }: { trend: 'up' | 'down' | 'flat'; color?: string }) {
  const points = trend === 'up' ? '2,22 12,20 22,22 32,16 42,17 52,9 62,11 74,3' : trend === 'down' ? '2,4 12,7 22,6 32,12 42,11 52,16 62,15 74,22' : '2,13 12,11 22,14 32,12 42,13 52,12 62,14 74,13';
  return (
    <svg aria-hidden="true" className="h-7 w-[76px]" viewBox="0 0 76 26">
      <polyline points={points} className="chart-line" style={{ color }} />
    </svg>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={14} />;
  if (trend === 'down') return <TrendingDown size={14} />;
  return <ArrowRight size={14} />;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { href: '/', label: 'Live board', icon: LayoutDashboard, testId: 'link-dashboard' },
    { href: '/insights', label: 'Model insights', icon: LineChartIcon, testId: 'link-insights' },
  ];
  return (
    <div className="app-noise min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[82px] items-center border-b border-[hsl(var(--sidebar-border))] px-6">
          <Link href="/" data-testid="link-brand" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><ShieldCheck size={20} strokeWidth={2.4} /></span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-[-.035em]">MedGuard <span className="text-[hsl(var(--sidebar-primary))]">AI</span></span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.58)]">Clinical command</span>
            </span>
          </Link>
        </div>
        <div className="px-4 pt-8">
          <p className="px-3 font-mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)]">Workspace</p>
          <nav className="mt-3 space-y-1">
            {navItems.map(({ href, label, icon: Icon, testId }) => {
              const active = href === '/' ? location === '/' : location.startsWith(href);
              return (
                <Link key={href} href={href} data-testid={testId} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent)/.65)] hover:text-[hsl(var(--sidebar-foreground))]'}`}>
                  <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-[hsl(var(--sidebar-border))] p-5">
          <div className="mb-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.13em] text-[hsl(var(--sidebar-foreground)/.52)]">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" /> Signal stream live
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--sidebar-accent))] text-xs font-bold text-[hsl(var(--sidebar-primary))]">NR</span>
            <div><p className="text-[12px] font-semibold">Nadia Ruiz, RN</p><p className="mt-0.5 text-[10px] text-[hsl(var(--sidebar-foreground)/.5)]">Night shift · ICU North</p></div>
            <ChevronDown size={14} className="ml-auto text-[hsl(var(--sidebar-foreground)/.5)]" />
          </div>
        </div>
      </aside>
      {mobileOpen && <button data-testid="button-close-navigation" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[hsl(var(--sidebar)/.55)] md:hidden" />}
      <div className="min-h-[100dvh] md:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3">
            <button data-testid="button-open-navigation" aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-md p-2 hover:bg-muted md:hidden"><Menu size={20} /></button>
            <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Northstar Health System</p><p className="mt-0.5 text-[12px] font-semibold text-foreground">{location === '/insights' ? 'Model insights' : location.startsWith('/patient') ? 'Patient review' : 'Live monitoring'}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:flex"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-600" /> Feed synced</span>
            <button data-testid="button-notifications" aria-label="Open notifications" className="relative rounded-lg border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground"><Bell size={17} /><span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1 font-mono text-[9px] font-bold text-[hsl(var(--accent-foreground))]">3</span></button>
            <div className="hidden h-7 w-px bg-border sm:block" />
            <span className="hidden text-right sm:block"><span className="block text-[11px] font-bold">Nadia Ruiz</span><span className="block font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">RN · ICU North</span></span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary)/.12)] text-xs font-bold text-[hsl(var(--primary))]">NR</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-5 py-7 md:px-9 md:py-9">{children}</main>
      </div>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 border-b border-border pb-7 md:flex-row md:items-end"><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-2 text-[clamp(1.7rem,3vw,2.5rem)] font-extrabold tracking-[-.055em] text-foreground">{title}</h1><p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p></div>{children}</div>;
}

function SkeletonBoard() {
  return <div className="space-y-6" data-testid="loading-dashboard"><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl border border-border bg-card p-5"><div className="skeleton h-3 w-20 rounded" /><div className="skeleton mt-5 h-7 w-14 rounded" /></div>)}</div><div className="h-96 rounded-xl border border-border bg-card p-6"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton mt-6 h-64 w-full rounded" /></div></div>;
}

function ErrorState({ onRetry, label = 'The patient signal could not be loaded.' }: { onRetry?: () => void; label?: string }) {
  return <div data-testid="state-error" className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.045)] p-8 text-center"><CircleAlert size={30} className="text-[hsl(var(--destructive))]" /><h2 className="mt-4 text-sm font-bold">Signal interrupted</h2><p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{label} Check the connection and try again.</p>{onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]"><RefreshCw size={13} /> Retry</button>}</div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'default' }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: 'default' | 'alert' }) {
  return <div data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`} className={`relative overflow-hidden rounded-xl border p-5 ${tone === 'alert' ? 'border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.09)]' : 'border-border bg-card'}`}><div className="flex items-start justify-between"><p className="font-mono text-[9px] uppercase tracking-[.15em] text-muted-foreground">{label}</p><span className={`rounded-md p-1.5 ${tone === 'alert' ? 'bg-[hsl(var(--accent)/.25)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'}`}><Icon size={15} /></span></div><p className="mt-4 text-3xl font-extrabold tracking-[-.06em]">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>;
}

function VitalCell({ label, value, unit, warning }: { label: string; value: string | number; unit: string; warning?: boolean }) {
  return <div data-testid={`vital-${label.toLowerCase().replace(/\s/g, '-')}`} className={`rounded-lg border p-3 ${warning ? 'border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.07)]' : 'border-border bg-background/50'}`}><p className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className={`mt-2 font-mono text-xl font-medium tracking-[-.06em] ${warning ? 'text-[hsl(var(--destructive))]' : ''}`}>{value}<span className="ml-1 text-[10px] tracking-normal text-muted-foreground">{unit}</span></p></div>;
}

function RiskGauge({ score = 0, level = 'stable' }: { score?: number; level?: string }) {
  const safeScore = Math.max(0, Math.min(1, score));
  const circumference = 2 * Math.PI * 45;
  const tone = level === 'critical' ? 'hsl(var(--destructive))' : level === 'warning' ? 'hsl(var(--accent))' : 'hsl(var(--primary))';
  return <div data-testid="risk-gauge" className="relative flex h-40 w-40 items-center justify-center">
    <svg viewBox="0 0 112 112" className="-rotate-90 h-full w-full" aria-hidden="true">
      <circle cx="56" cy="56" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
      <circle cx="56" cy="56" r="45" fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - safeScore)} />
    </svg>
    <div className="absolute text-center"><p className="font-mono text-3xl font-medium tracking-[-.08em]" data-testid="text-risk-gauge-value">{Math.round(safeScore * 100)}%</p><p className="font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">AI risk</p></div>
  </div>;
}

function PatientRow({ patient }: { patient: PatientSummary }) {
  const level = patient.latestRisk?.riskLevel || 'stable';
  return <Link href={`/patient/${patient.id}`} data-testid={`row-patient-${patient.id}`} className="group grid grid-cols-[minmax(180px,1.25fr)_minmax(120px,.75fr)_minmax(160px,1fr)_100px_84px] items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-[hsl(var(--primary)/.035)]">
    <div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${level === 'critical' ? 'bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'}`}>{patient.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div className="min-w-0"><p data-testid={`text-patient-name-${patient.id}`} className="truncate text-[13px] font-bold group-hover:text-[hsl(var(--primary))]">{patient.name}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{patient.age} yrs · {patient.ward}</p></div></div>
    <div><RiskBadge level={level} /></div>
    <div className="grid grid-cols-4 gap-2"><span className="font-mono text-[11px]">{patient.latestVitals?.heartRate ?? '—'} <small className="text-muted-foreground">bpm</small></span><span className={`font-mono text-[11px] ${patient.latestVitals?.spo2 && patient.latestVitals.spo2 < 94 ? 'text-[hsl(var(--destructive))]' : ''}`}>{patient.latestVitals?.spo2 ?? '—'} <small className="text-muted-foreground">%</small></span><span className="font-mono text-[11px]">{patient.latestVitals?.respiratoryRate ?? '—'} <small className="text-muted-foreground">rr</small></span><span className="font-mono text-[11px]">{patient.latestVitals?.temperature ?? '—'} <small className="text-muted-foreground">°C</small></span></div>
    <div className={`flex items-center gap-1.5 font-mono text-[10px] ${patient.riskTrend === 'up' ? 'text-[hsl(var(--destructive))]' : 'text-muted-foreground'}`}><TrendIcon trend={patient.riskTrend} /> {patient.riskTrend === 'up' ? 'Rising' : patient.riskTrend === 'down' ? 'Falling' : 'Steady'}</div>
    <div className="flex items-center justify-between gap-2"><span data-testid={`text-alert-count-${patient.id}`} className={`font-mono text-[11px] ${patient.alertCount ? 'font-bold text-[hsl(var(--destructive))]' : 'text-muted-foreground'}`}>{patient.alertCount || '—'}</span><ArrowRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-1" /></div>
  </Link>;
}

function AlertFeed({ patients }: { patients: PatientSummary[] }) {
  const alerts = patients.flatMap((p) => p.latestRisk?.topFactors?.slice(0, 1).map((factor) => ({ patient: p, factor })) || []).filter(({ patient }) => patient.latestRisk?.riskLevel !== 'stable').slice(0, 5);
  return <section className="rounded-xl border border-border bg-card" data-testid="panel-alert-feed"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Signal feed</p><h2 className="mt-1 text-sm font-extrabold tracking-[-.02em]">Why risk is moving</h2></div><span className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--destructive)/.09)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] text-[hsl(var(--destructive))]"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--destructive))]" /> Live</span></div><div className="divide-y divide-border">{alerts.length ? alerts.map(({ patient, factor }) => <Link href={`/patient/${patient.id}`} key={`${patient.id}-${factor.feature}`} data-testid={`alert-feed-${patient.id}`} className="flex gap-3 px-5 py-4 transition-colors hover:bg-muted/60"><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${riskMeta[patient.latestRisk.riskLevel as RiskLevel]?.dot || 'bg-muted-foreground'}`} /><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-[12px] font-bold">{patient.name}</p><span className="shrink-0 font-mono text-[9px] text-muted-foreground">{relativeTime(patient.lastUpdated)}</span></div><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{factor.description || `${factor.feature} is contributing to the current risk score.`}</p></div></Link>) : <div data-testid="empty-alert-feed" className="px-5 py-10 text-center"><Check size={22} className="mx-auto text-emerald-600" /><p className="mt-3 text-xs font-semibold">No active risk movement</p><p className="mt-1 text-[11px] text-muted-foreground">The monitored cohort is holding steady.</p></div>}</div><div className="border-t border-border px-5 py-3"><Link href="/" data-testid="link-all-alerts" className="font-mono text-[10px] uppercase tracking-[.1em] text-[hsl(var(--primary))] hover:underline">View all signals <ArrowRight className="ml-1 inline" size={12} /></Link></div></section>;
}

function SimulationPanel({ onUpdated }: { onUpdated: (patients: PatientSummary[]) => void }) {
  const tick = useTickSimulation();
  const fastForward = useFastForwardSimulation();
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const run = (kind: 'tick' | 'fast') => {
    const mutation = kind === 'tick' ? tick : fastForward;
    mutation.mutate(undefined, { onSuccess: (update) => {
      onUpdated(update.patients);
      setLastRun(update.simulatedTime);
      if (update.newlyAlerted.length) {
        setAlertMessage(update.newlyAlerted[0].message);
        window.setTimeout(() => setAlertMessage(null), 6000);
      }
    } });
  };
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => run('tick'), 4000);
    return () => window.clearInterval(interval);
  }, [running]);
  return <section data-testid="panel-simulation" className="relative overflow-hidden rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.055)] p-5">
    {alertMessage && <div data-testid="toast-simulation-alert" className="fixed right-5 top-20 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-card p-4 shadow-xl"><span className="rounded-lg bg-[hsl(var(--destructive)/.1)] p-2 text-[hsl(var(--destructive))]"><Bell size={15} /></span><div><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--destructive))]">New clinical alert</p><p className="mt-1 text-xs font-bold">{alertMessage}</p></div><button data-testid="button-dismiss-alert" aria-label="Dismiss alert" onClick={() => setAlertMessage(null)} className="ml-2 text-muted-foreground hover:text-foreground"><X size={14} /></button></div>}
    <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-[hsl(var(--primary)/.07)]" /><div className="relative"><div className="flex items-start gap-3"><span className="rounded-lg bg-[hsl(var(--primary)/.12)] p-2 text-[hsl(var(--primary))]"><FlaskConical size={17} /></span><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Simulation lab</p><h2 className="mt-1 text-sm font-extrabold">Test the signal before it moves</h2></div></div><p className="mt-3 max-w-sm text-[11px] leading-relaxed text-muted-foreground">Advance the synthetic ward clock to observe how MedGuard surfaces deterioration.</p><div className="mt-5 flex flex-wrap gap-2"><button data-testid="button-start-simulation" disabled={tick.isPending || fastForward.isPending} onClick={() => setRunning((value) => !value)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold ${running ? 'border border-[hsl(var(--destructive)/.3)] bg-card text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110'}`}><Activity size={14} /> {running ? 'Stop simulation' : 'Start simulation'}</button><button data-testid="button-simulation-tick" disabled={tick.isPending || fastForward.isPending} onClick={() => run('tick')} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--primary)/.28)] bg-card px-3 py-2 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)] disabled:opacity-50"><TimerReset size={14} /> Advance 1 hour</button><button data-testid="button-simulation-fast-forward" disabled={tick.isPending || fastForward.isPending} onClick={() => run('fast')} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--primary)/.28)] bg-card px-3 py-2 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)] disabled:opacity-50"><Zap size={14} /> Fast-forward to event</button></div>{lastRun && <p data-testid="text-simulation-time" className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground"><Check size={12} className="text-emerald-600" /> Ward clock · {timeLabel(lastRun)}</p>}</div></section>;
}

function Dashboard() {
  const patientsQuery = useGetPatients();
  const queryClient = useQueryClient();
  const patients = patientsQuery.data || [];
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [sort, setSort] = useState<SortKey>('risk');
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const filtered = useMemo(() => patients.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) && (riskFilter === 'all' || p.latestRisk?.riskLevel === riskFilter)).sort((a, b) => sort === 'updated' ? new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime() : (b.latestRisk?.mlRiskScore || 0) - (a.latestRisk?.mlRiskScore || 0)), [patients, query, riskFilter, sort]);
  const critical = patients.filter((p) => p.latestRisk?.riskLevel === 'critical').length;
  const watch = patients.filter((p) => ['watch', 'warning'].includes(p.latestRisk?.riskLevel || '')).length;
  const acknowledged = patients.reduce((sum, p) => sum + Math.max(0, p.alertCount - 1), 0);
  const onSimulation = (next: PatientSummary[]) => { queryClient.setQueryData(getGetPatientsQueryKey(), next); setUpdatedAt(Date.now()); };
  if (patientsQuery.isLoading) return <SkeletonBoard />;
  if (patientsQuery.isError) return <ErrorState onRetry={() => patientsQuery.refetch()} />;
  return <div data-testid="page-dashboard">
    <PageIntro eyebrow="Live command center · ICU North" title="Keep the ward one step ahead." description="A clear view of who needs you now, what changed, and why. MedGuard watches the signal so your team can stay with the patient."><div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Last refresh</span><span data-testid="text-last-refresh" className="mt-1 block text-[12px] font-semibold">{relativeTime(new Date(updatedAt).toISOString())}</span></span><button data-testid="button-refresh-patients" onClick={() => patientsQuery.refetch()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[11px] font-bold hover:bg-muted"><RefreshCw size={14} /> Refresh</button></div></PageIntro>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Monitored now" value={patients.length} detail="Patients with live signal" icon={HeartPulse} /><MetricCard label="Needs attention" value={watch + critical} detail={`${critical} critical · ${watch} watch / warning`} icon={CircleAlert} tone={critical ? 'alert' : 'default'} /><MetricCard label="Critical risk" value={critical} detail={critical ? 'Review immediately' : 'No critical signals'} icon={Gauge} tone={critical ? 'alert' : 'default'} /><MetricCard label="Signals today" value={acknowledged + patients.reduce((sum, p) => sum + p.alertCount, 0)} detail="Across monitored cohort" icon={Activity} /></div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 rounded-xl border border-border bg-card" data-testid="panel-monitored-patients"><div className="flex flex-col gap-4 border-b border-border px-5 py-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Patient watchlist</p><h2 className="mt-1 text-sm font-extrabold">Monitored patients <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{patients.length}</span></h2></div><div className="flex flex-wrap items-center gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-patient-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a patient" className="h-9 w-[180px] rounded-lg border border-border bg-background pl-9 pr-3 text-[11px] outline-none placeholder:text-muted-foreground focus:border-[hsl(var(--primary))]" /></div><select data-testid="select-risk-filter" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as 'all' | RiskLevel)} className="h-9 rounded-lg border border-border bg-background px-3 text-[11px] font-semibold outline-none"><option value="all">All risk levels</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="watch">Watch</option><option value="stable">Stable</option></select><button data-testid="button-sort-patients" onClick={() => setSort(sort === 'risk' ? 'updated' : 'risk')} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><SlidersHorizontal size={13} /> {sort === 'risk' ? 'Risk first' : 'Recent first'}</button></div></div><div className="hidden grid-cols-[minmax(180px,1.25fr)_minmax(120px,.75fr)_minmax(160px,1fr)_100px_84px] gap-4 border-b border-border bg-muted/40 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground md:grid"><span>Patient</span><span>Risk</span><span>Vitals · current</span><span>Trend</span><span>Alerts</span></div>{filtered.length ? <div>{filtered.map((patient) => <PatientRow key={patient.id} patient={patient} />)}</div> : <div data-testid="empty-patient-search" className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center"><Search size={25} className="text-muted-foreground" /><p className="mt-3 text-sm font-bold">No patients match that view</p><p className="mt-1 text-xs text-muted-foreground">Try a different name or risk level.</p><button data-testid="button-clear-patient-filter" onClick={() => { setQuery(''); setRiskFilter('all'); }} className="mt-4 text-xs font-bold text-[hsl(var(--primary))] hover:underline">Clear filters</button></div>}</section>
      <div className="space-y-6"><AlertFeed patients={patients} /><SimulationPanel onUpdated={onSimulation} /></div>
    </div>
  </div>;
}

function LineChart({ values, secondary, labels, color = 'hsl(var(--primary))', secondaryColor = 'hsl(var(--accent))' }: { values: number[]; secondary?: number[]; labels?: string[]; color?: string; secondaryColor?: string }) {
  const all = [...values, ...(secondary || [])];
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const points = (series: number[]) => series.map((value, index) => `${(index / Math.max(series.length - 1, 1)) * 100},${100 - ((value - min) / (max - min || 1)) * 82 - 8}`).join(' ');
  return <div className="relative h-[220px] w-full"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible"><line x1="0" x2="100" y1="16" y2="16" className="chart-grid" /><line x1="0" x2="100" y1="50" y2="50" className="chart-grid" /><line x1="0" x2="100" y1="84" y2="84" className="chart-grid" /><polyline points={points(values)} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />{secondary && <polyline points={points(secondary)} fill="none" stroke={secondaryColor} strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" />}</svg><div className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-[9px] text-muted-foreground">{(labels || ['Earlier', '—', '—', 'Now']).map((label, i) => <span key={i}>{label}</span>)}</div></div>;
}

function Explainability({ score }: { score?: RiskScore }) {
  const factors = score?.topFactors || [];
  return <section data-testid="panel-explainability" className="rounded-xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Explainability</p><h2 className="mt-1 text-sm font-extrabold">What is driving risk</h2></div><div className="p-5">{factors.length ? <div className="space-y-4">{factors.slice(0, 4).map((factor, i) => <div data-testid={`factor-${i}`} key={`${factor.feature}-${i}`}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${factor.direction === 'increasing' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'}`}>{factor.direction === 'increasing' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}</span><span className="truncate text-[12px] font-bold">{factor.feature}</span></div><span className="font-mono text-[10px] text-muted-foreground">{Math.round(Math.abs(factor.impact) * 100)}% impact</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${factor.direction === 'increasing' ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary))]'}`} style={{ width: `${Math.min(100, Math.max(10, Math.abs(factor.impact) * 100))}%` }} /></div><p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{factor.description}</p></div>)}</div> : <div className="py-7 text-center text-xs text-muted-foreground">No contributing factors available yet.</div>}<div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[10px] leading-relaxed text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /> MedGuard combines the current vital pattern with recent trajectory. It is a support signal, not a diagnosis.</div></div></section>;
}

function VitalHistory({ detail }: { detail: PatientDetail }) {
  const readings = detail.vitalsHistory || [];
  const values = readings.map((v) => v.heartRate);
  const oxygen = readings.map((v) => v.spo2);
  return <section data-testid="panel-vitals-history" className="rounded-xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Vitals over time</p><h2 className="mt-1 text-sm font-extrabold">The trend behind the reading</h2></div><div className="flex items-center gap-4 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-1.5 w-4 rounded-full bg-[hsl(var(--primary))]" /> Heart rate</span><span className="flex items-center gap-1.5"><i className="h-1.5 w-4 rounded-full bg-[hsl(var(--accent))]" /> SpO₂</span></div></div><div className="p-5">{readings.length > 1 ? <LineChart values={values} secondary={oxygen} labels={readings.length ? [timeLabel(readings[0].timestamp), '', '', timeLabel(readings[readings.length - 1].timestamp)] : undefined} /> : <div className="py-10 text-center text-xs text-muted-foreground">More readings will appear as the monitoring window fills.</div>}<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><VitalCell label="Heart rate" value={detail.latestVitals?.heartRate ?? '—'} unit="bpm" warning={(detail.latestVitals?.heartRate || 0) > 110} /><VitalCell label="SpO₂" value={detail.latestVitals?.spo2 ?? '—'} unit="%" warning={(detail.latestVitals?.spo2 || 100) < 94} /><VitalCell label="Resp. rate" value={detail.latestVitals?.respiratoryRate ?? '—'} unit="/min" warning={(detail.latestVitals?.respiratoryRate || 0) > 22} /><VitalCell label="Temperature" value={detail.latestVitals?.temperature ?? '—'} unit="°C" warning={(detail.latestVitals?.temperature || 0) > 38} /></div></div></section>;
}

function AlertHistory({ patientId, alerts }: { patientId: number; alerts: Alert[] }) {
  const ack = useAcknowledgeAlert();
  const queryClient = useQueryClient();
  const acknowledge = (alertId: number) => ack.mutate({ id: patientId, alertId }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) }); queryClient.invalidateQueries({ queryKey: getGetPatientsQueryKey() }); } });
  return <section data-testid="panel-alert-history" className="rounded-xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Alert history</p><h2 className="mt-1 text-sm font-extrabold">Clinical signal log</h2></div><div className="divide-y divide-border">{alerts.length ? alerts.map((alert) => <div data-testid={`alert-row-${alert.id}`} key={alert.id} className="flex gap-3 px-5 py-4"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${riskMeta[alert.riskLevel as RiskLevel]?.dot || 'bg-muted-foreground'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><RiskBadge level={alert.riskLevel} compact /><span className="font-mono text-[9px] text-muted-foreground">{dateLabel(alert.timestamp)} · {timeLabel(alert.timestamp)}</span></div><p className="mt-2 text-[11px] leading-relaxed">{alert.message}</p></div>{alert.acknowledged ? <span className="flex shrink-0 items-center gap-1 self-start font-mono text-[9px] uppercase tracking-[.08em] text-emerald-700"><Check size={12} /> Done</span> : <button data-testid={`button-acknowledge-alert-${alert.id}`} disabled={ack.isPending} onClick={() => acknowledge(alert.id)} className="shrink-0 self-start rounded-md border border-border px-2 py-1.5 font-mono text-[9px] font-medium uppercase tracking-[.08em] text-muted-foreground hover:border-[hsl(var(--primary)/.35)] hover:text-[hsl(var(--primary))] disabled:opacity-50">Acknowledge</button>}</div>) : <div data-testid="empty-patient-alerts" className="py-12 text-center"><Check size={22} className="mx-auto text-emerald-600" /><p className="mt-3 text-xs font-semibold">No alerts recorded</p><p className="mt-1 text-[11px] text-muted-foreground">This patient has a quiet signal history.</p></div>}</div></section>;
}

function PatientPage() {
  const params = useParams<{ id: string }>();
  const patientId = Number(params.id);
  const patientQuery = useGetPatient(patientId, { query: { enabled: Number.isFinite(patientId), queryKey: getGetPatientQueryKey(patientId) } });
  if (patientQuery.isLoading) return <div data-testid="loading-patient" className="space-y-6"><div className="skeleton h-10 w-56 rounded" /><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-80 rounded-xl" /></div>;
  if (patientQuery.isError || !patientQuery.data) return <ErrorState onRetry={() => patientQuery.refetch()} label="This patient record is not available." />;
  const patient = patientQuery.data;
  const score = patient.latestRisk;
  return <div data-testid={`page-patient-${patient.id}`}><Link href="/" data-testid="link-back-dashboard" className="mb-7 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground hover:text-[hsl(var(--primary))]"><ArrowLeft size={14} /> Back to live board</Link><PageIntro eyebrow={`${patient.ward} · Patient ${patient.id}`} title={patient.name} description={`Age ${patient.age} · Admitted ${dateLabel(patient.admissionDate)} · Monitoring since ${timeLabel(patient.lastUpdated)}`}><div className="flex items-center gap-4"><RiskGauge score={score?.mlRiskScore} level={score?.riskLevel} /><div><RiskBadge level={score?.riskLevel} /><p data-testid="text-patient-risk-score" className="mt-2 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">NEWS2 {score?.news2Score ?? '—'}</p></div></div></PageIntro><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><VitalCell label="Heart rate" value={patient.latestVitals?.heartRate ?? '—'} unit="bpm" warning={(patient.latestVitals?.heartRate || 0) > 110} /><VitalCell label="SpO₂" value={patient.latestVitals?.spo2 ?? '—'} unit="%" warning={(patient.latestVitals?.spo2 || 100) < 94} /><VitalCell label="Blood pressure" value={`${patient.latestVitals?.systolicBp ?? '—'}`} unit="mmHg" warning={(patient.latestVitals?.systolicBp || 120) < 90} /><VitalCell label="Resp. rate" value={patient.latestVitals?.respiratoryRate ?? '—'} unit="/min" warning={(patient.latestVitals?.respiratoryRate || 0) > 22} /></div><div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.7fr)]"><div className="space-y-6"><VitalHistory detail={patient} /><RiskComparison patient={patient} /><AlertHistory patientId={patient.id} alerts={patient.alerts || []} /></div><div><Explainability score={score} /></div></div></div>;
}

function RiskComparison({ patient }: { patient: PatientDetail }) {
  const history = patient.riskHistory || [];
  const ml = history.map((r) => r.mlRiskScore);
  const news = history.map((r) => r.news2Score * 10);
  return <section data-testid="panel-risk-comparison" className="rounded-xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Model comparison</p><h2 className="mt-1 text-sm font-extrabold">MedGuard vs NEWS2</h2></div><span className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary)/.08)] px-2 py-1 font-mono text-[9px] uppercase tracking-[.09em] text-[hsl(var(--primary))]"><Sparkles size={12} /> Pattern-aware</span></div><div className="p-5"><div className="mb-5 grid grid-cols-2 gap-3"><div className="rounded-lg border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--primary)/.05)] p-3"><p className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">MedGuard AI</p><p data-testid="text-ai-score" className="mt-2 text-2xl font-extrabold text-[hsl(var(--primary))]">{patient.latestRisk?.mlRiskScore ?? '—'}<span className="ml-1 text-[10px] font-medium text-muted-foreground">risk index</span></p></div><div className="rounded-lg border border-border bg-background/50 p-3"><p className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">NEWS2</p><p data-testid="text-news2-score" className="mt-2 text-2xl font-extrabold">{patient.latestRisk?.news2Score ?? '—'}<span className="ml-1 text-[10px] font-medium text-muted-foreground">score</span></p></div></div>{history.length > 1 ? <LineChart values={ml} secondary={news} labels={[timeLabel(history[0].timestamp), '', '', timeLabel(history[history.length - 1].timestamp)]} /> : <div className="py-10 text-center text-xs text-muted-foreground">Comparison appears after multiple risk assessments.</div>}<div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /> Scores are shown on separate clinical scales. The comparison highlights trajectory, not a one-to-one equivalence.</div></div></section>;
}

function PerformanceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return <div data-testid={`insight-metric-${label.toLowerCase()}`}><div className="flex justify-between text-[11px]"><span className="font-semibold">{label}</span><span className="font-mono font-medium">{percent(value)}</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} /></div></div>;
}

function InsightsPage() {
  const insightsQuery = useGetInsights({ query: { queryKey: getGetInsightsQueryKey() } });
  if (insightsQuery.isLoading) return <div data-testid="loading-insights" className="space-y-6"><div className="skeleton h-12 w-80 rounded" /><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div><div className="skeleton h-96 rounded-xl" /></div>;
  if (insightsQuery.isError || !insightsQuery.data) return <ErrorState onRetry={() => insightsQuery.refetch()} label="Model insights are temporarily unavailable." />;
  const insights = insightsQuery.data;
  const matrix = insights.confusionMatrix;
  const maxImportance = Math.max(...insights.featureImportance.map((item) => item.importance), 1);
  return <div data-testid="page-insights"><PageIntro eyebrow="Model transparency · Version 2.4" title="Know what the model knows." description="Performance, decision boundaries, and the signals that matter most. Built for clinical review, not black-box confidence." ><span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-600" /> Evaluated continuously</span></PageIntro><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="AUC" value={percent(insights.auc)} detail="Discrimination across thresholds" icon={LineChartIcon} /><MetricCard label="Precision" value={percent(insights.precision)} detail="Alerts that were meaningful" icon={ShieldCheck} /><MetricCard label="Recall" value={percent(insights.recall)} detail="Deterioration found in time" icon={Search} /><MetricCard label="Samples evaluated" value={insights.evaluatedSamples.toLocaleString()} detail="Held-out patient windows" icon={Activity} /></div><div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]"><section data-testid="panel-roc-curve" className="rounded-xl border border-border bg-card"><div className="flex items-start justify-between border-b border-border px-5 py-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Discrimination</p><h2 className="mt-1 text-sm font-extrabold">ROC curve</h2></div><span className="rounded-md bg-[hsl(var(--primary)/.08)] px-2 py-1 font-mono text-[10px] font-medium text-[hsl(var(--primary))]">AUC {percent(insights.auc)}</span></div><div className="p-5"><RocChart points={insights.rocCurve} /></div></section><section data-testid="panel-confusion-matrix" className="rounded-xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Evaluation detail</p><h2 className="mt-1 text-sm font-extrabold">Confusion matrix</h2></div><div className="p-5"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-emerald-600/20 bg-emerald-600/[.07] p-4"><p className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">True negative</p><p data-testid="matrix-true-negative" className="mt-2 text-2xl font-extrabold text-emerald-700">{matrix.trueNegative}</p></div><div className="rounded-lg border border-amber-500/25 bg-amber-500/[.08] p-4"><p className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">False positive</p><p data-testid="matrix-false-positive" className="mt-2 text-2xl font-extrabold text-amber-700">{matrix.falsePositive}</p></div><div className="rounded-lg border border-red-600/20 bg-red-600/[.06] p-4"><p className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">False negative</p><p data-testid="matrix-false-negative" className="mt-2 text-2xl font-extrabold text-red-700">{matrix.falseNegative}</p></div><div className="rounded-lg border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--primary)/.06)] p-4"><p className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">True positive</p><p data-testid="matrix-true-positive" className="mt-2 text-2xl font-extrabold text-[hsl(var(--primary))]">{matrix.truePositive}</p></div></div><p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">Outcomes are assessed against documented deterioration events in the evaluation window.</p></div></section></div><div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.75fr)]"><section data-testid="panel-feature-importance" className="rounded-xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Model methodology</p><h2 className="mt-1 text-sm font-extrabold">Signals with the most influence</h2></div><div className="space-y-5 p-5">{insights.featureImportance.map((item, index) => <div data-testid={`feature-importance-${index}`} key={item.feature}><div className="flex justify-between gap-4"><span className="text-[12px] font-semibold">{item.feature}</span><span className="font-mono text-[10px] text-muted-foreground">{percent(item.importance)}</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${(item.importance / maxImportance) * 100}%` }} /></div></div>)}</div></section><section className="rounded-xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.09)] p-5" data-testid="panel-methodology-note"><div className="flex items-start gap-3"><span className="rounded-lg bg-[hsl(var(--accent)/.25)] p-2 text-[hsl(var(--accent-foreground))]"><Stethoscope size={17} /></span><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">Designed for the bedside</p><h2 className="mt-1 text-sm font-extrabold">Explainable by default</h2></div></div><p className="mt-5 text-[12px] leading-relaxed text-foreground/75">Every elevated score is paired with the current contributing factors and the recent direction of travel. The model supports clinical judgment; it never replaces it.</p><div className="mt-5 border-t border-[hsl(var(--accent)/.28)] pt-4"><p className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Evaluation protocol</p><p className="mt-2 text-[11px] leading-relaxed text-foreground/70">Patient-level holdout · temporal validation · calibrated at the alert threshold used in Live Board.</p></div></section></div></div>;
}

function RocChart({ points }: { points: { fpr: number; tpr: number }[] }) {
  const plotted = points.length ? points : [{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }];
  const path = plotted.map((point) => `${point.fpr * 100},${100 - point.tpr * 100}`).join(' ');
  return <div className="relative h-[280px] pl-8 pb-7"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-[calc(100%-28px)] w-[calc(100%-32px)] overflow-visible"><line x1="0" x2="100" y1="100" y2="0" stroke="hsl(var(--border))" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /><line x1="0" x2="100" y1="100" y2="100" stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" /><line x1="0" x2="0" y1="0" y2="100" stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" /><polyline points={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="absolute bottom-0 left-8 font-mono text-[9px] text-muted-foreground">False positive rate</span><span className="absolute left-0 top-1/2 -rotate-90 font-mono text-[9px] text-muted-foreground">True positive rate</span><span className="absolute bottom-1 right-2 font-mono text-[9px] text-muted-foreground">1.0</span><span className="absolute bottom-1 left-8 font-mono text-[9px] text-muted-foreground">0.0</span></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell><Switch><Route path="/" component={Dashboard} /><Route path="/patient/:id" component={PatientPage} /><Route path="/insights" component={InsightsPage} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;