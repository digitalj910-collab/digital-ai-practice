import type { ReactNode } from 'react'
import {
  BarChart3,
  Bell,
  Calculator,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  GanttChartSquare,
  Gauge,
  GitBranch,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Lock,
  MessageSquare,
  Receipt,
  Rocket,
  Tag,
  Users,
  Wallet,
} from 'lucide-react'
import { PageHeader } from './ui'
import { PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS } from '../types'
import type { View } from './Sidebar'

export function HelpView({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={<HelpCircle size={22} />}
        accent="#c8102e"
        title="Help & Guide"
        subtitle="Everything in Program Pulse — every screen, every tool, and who can do what. Tap a section to open it."
      />

      {/* Short intro, always visible */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">What is Program Pulse?</h3>
        <p className="mt-1 text-sm text-slate-600">
          One place to run your whole portfolio — every team, program, timeline, risk, weekly update,
          budget and resourcing plan. Managers report once for their team; leadership always sees the
          current picture and can plan, budget and drill in without chasing anyone.
        </p>
      </div>

      <Section icon={<Rocket size={17} />} title="Quick start — 5 steps" defaultOpen>
        <ol className="space-y-2.5">
          <Step n={1} title="Start on the Overview">
            The whole portfolio at a glance — health tiles across the top, a card per team below. Click
            a team card to open it.
          </Step>
          <Step n={2} title="Open a team, then a project">
            A team (domain) shows its programs, timeline and planning tools. Click a program to see its
            tasks, resourcing, budget and update history.
          </Step>
          <Step n={3} title="Post the weekly check-in">
            Each manager files <strong>one card for their team</strong> — a short narrative plus any
            project status changes — in <strong>Weekly Updates</strong> or from their team page.
          </Step>
          <Step n={4} title="Plan & budget">
            Use the <strong>Delivery Estimator</strong>, <strong>Capacity Calculator</strong> and each
            team's <strong>Rate card</strong> to size, staff and cost work; watch it roll up on{' '}
            <strong>Budget</strong>.
          </Step>
          <Step n={5} title="Report">
            Leadership reads the timeline, alerts, capacity and budget, comments on any update, and
            drills into any team or project.
          </Step>
        </ol>
      </Section>

      {/* ---- Every screen ---- */}
      <Section icon={<LayoutDashboard size={17} />} title="Every screen, explained" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScreenCard icon={<LayoutDashboard size={18} />} color="#c8102e" title="Overview (Portfolio)" onClick={() => onNavigate({ k: 'home' })}>
            Portfolio health tiles — Programs, At risk, Watch, Deprioritized and Planning
            effectiveness — plus a card per team with average progress. Click a team to drill in.
            Add a domain or open the Estimator from here.
          </ScreenCard>
          <ScreenCard icon={<FolderKanban size={18} />} color="#0ea5e9" title="Team (Domain) view">
            One team's world: its programs, an area snapshot, a type-coloured timeline, and the
            planning tools. Add / import projects, filter by project type, run the weekly check-in,
            and open that team's own rate card, estimator and capacity calculator.
          </ScreenCard>
          <ScreenCard icon={<GanttChartSquare size={18} />} color="#0d9488" title="Project (Program) detail">
            A single project up close — its task Gantt, resourcing, budget, status with audit trail,
            and the full weekly-update thread with comments and edit history. Add tasks, post updates
            and change status here.
          </ScreenCard>
          <ScreenCard icon={<GanttChartSquare size={18} />} color="#6366f1" title="Portfolio Timeline" onClick={() => onNavigate({ k: 'portfolio' })}>
            Every program across all teams on one timeline, grouped and coloured by team. Zoom from
            Day to 2 Years, overlay PI / sprint cadence, and see where each was flagged.
          </ScreenCard>
          <ScreenCard icon={<Bell size={18} />} color="#dc2626" title="Alerts" onClick={() => onNavigate({ k: 'alerts' })}>
            Only what needs attention now — overdue, behind schedule, blocked, or short on people —
            so nothing slips quietly.
          </ScreenCard>
          <ScreenCard icon={<ClipboardList size={18} />} color="#7c3aed" title="Weekly Updates" onClick={() => onNavigate({ k: 'weekly' })}>
            The status feed. Filter by period and team, group by week or team, read team check-ins and
            project updates, and discuss with comments. Leadership can edit — the original is kept.
          </ScreenCard>
          <ScreenCard icon={<Users size={18} />} color="#2563eb" title="Capacity Planning" onClick={() => onNavigate({ k: 'capacity' })}>
            Do we have enough people for the work? Coverage, the months where it gets tight, and which
            teams are short — plus the Capacity Calculator.
          </ScreenCard>
          <ScreenCard icon={<Wallet size={18} />} color="#16a34a" title="Budget" onClick={() => onNavigate({ k: 'budget' })}>
            Funds vs. forecast vs. spend, rolled up from programs to teams to the portfolio. Each team
            is costed with its own rate card. Set the default rate card here. Admin & Leadership only.
          </ScreenCard>
          <ScreenCard icon={<BarChart3 size={18} />} color="#c8102e" title="Reports & KPIs" onClick={() => onNavigate({ k: 'reports' })}>
            One place for portfolio KPIs — schedule health (on-time vs. baseline, slipped projects),
            budget health, scope & change control, and resource coverage. Click any row to drill in.
          </ScreenCard>
          <ScreenCard icon={<Calculator size={18} />} color="#ea580c" title="Estimator" onClick={() => onNavigate({ k: 'home' })}>
            A quick "when will it be done, and roughly what will it cost?" using T-shirt sizes and a
            team size. Also available per-team on a team's page.
          </ScreenCard>
          <ScreenCard icon={<HelpCircle size={18} />} color="#c8102e" title="Help & Guide" onClick={() => onNavigate({ k: 'help' })}>
            This page — a full reference for every screen, tool and access rule.
          </ScreenCard>
        </div>
      </Section>

      {/* ---- The timeline ---- */}
      <Section icon={<GanttChartSquare size={17} />} title="The timeline (Gantt), explained">
        <p className="text-sm text-slate-600">
          The same timeline powers the team and portfolio views. Everything on it is designed to be
          read at a glance:
        </p>
        <div className="mt-3 space-y-2.5">
          <Feature label="Zoom — Day → 2 Years">
            One control spans fine detail to a wide horizon (Day / Week / Month / Quarter / 6M / 1Y /
            18M / 2Y). It opens scrolled to <strong>today</strong>, marked by the red line.
          </Feature>
          <Feature label="Project-type colours">
            In a team view, bars are coloured by project type —{' '}
            <TypeChip t="enhancement" />, <TypeChip t="initiative" /> and <TypeChip t="technical" /> —
            with a legend above the chart and a matching square on each row. In the portfolio view,
            bars are coloured by team instead.
          </Feature>
          <Feature label="Status markers">
            A dated symbol appears where a project was flagged — Blocked, On hold, Cancelled,
            Postponed or Descoped — on the exact date it happened. Parked / stopped work is shown
            muted and struck through.
          </Feature>
          <Feature label="PI / Sprint cadence">
            Toggle the PI/Sprint overlay to see program-increment and sprint boundaries, with IP weeks
            highlighted.
          </Feature>
          <Feature label="Progress & hover">
            Each bar fills to its % complete; hovering shows the status, latest blocker and remaining
            work.
          </Feature>
        </div>
      </Section>

      {/* ---- Baseline & scope ---- */}
      <Section icon={<Landmark size={17} />} title="Baseline & scope changes">
        <div className="space-y-2.5">
          <Feature icon={<Lock size={15} />} label="Lock the agreed plan">
            Once a roadmap is agreed, open the project and <strong>Lock baseline</strong> — it captures
            the original start and end dates. The baseline never changes, so the originally-agreed plan
            is always preserved.
          </Feature>
          <Feature label="Planned vs. current at a glance">
            The Gantt draws a thin indigo <strong>"originally planned"</strong> bar beneath the live
            bar, so slippage is obvious. The project page shows planned vs. current dates and how many
            days early or late delivery now is.
          </Feature>
          <Feature icon={<GitBranch size={15} />} label="Log scope changes">
            When scope is added mid-flight, use <strong>Add scope change</strong> — it drops a dated
            amber "+" marker on the timeline and can push the delivery date out. The baseline stays put,
            so you always see the original plan against the new one.
          </Feature>
        </div>
      </Section>

      {/* ---- Planning & budgeting tools ---- */}
      <Section icon={<Gauge size={17} />} title="Planning & budgeting tools — and how we use them">
        <p className="text-sm text-slate-600">
          These live on each team's page (using <strong>that team's own</strong> rates and settings)
          and connect into one budget picture.
        </p>
        <div className="mt-3 space-y-2.5">
          <Feature icon={<Calculator size={15} />} label="Delivery Estimator">
            "When will it be done, and roughly what will it cost?" Pick a T-shirt size (or points),
            team size and buffer → likely sprints, a completion date and an estimated cost. Use it in
            the "business wants a date" conversation.
          </Feature>
          <Feature icon={<Gauge size={15} />} label="Capacity Calculator">
            The flip side — "how many people to hit this date?" Enter the work and dates → people
            needed; enter your current team → your real completion date and the gap.
          </Feature>
          <Feature icon={<Receipt size={15} />} label="Rate card (per team)">
            Each team sets its own cost-per-day by role, and can differ from other teams. These rates
            drive every labour-cost estimate — Estimator, kickoff and Budget. A team starts from the
            organisation default until it customises.
          </Feature>
          <Feature icon={<Wallet size={15} />} label="Budget model">
            Labour = staffing × role day-rate × working days; add other costs = <em>estimated</em>. A
            granted <em>fund</em> is the approved budget; <em>spend</em> comes from % complete (or an
            override); <em>forecast</em> projects the finish; <em>variance</em> is fund − forecast.
            It rolls up program → team → portfolio, each team on its own rates.
          </Feature>
          <Feature icon={<Tag size={15} />} label="T-shirt sizing">
            The size → story-point scale behind the estimators. Editable per team, so each can tune it
            to how they estimate.
          </Feature>
        </div>
      </Section>

      {/* ---- Weekly updates ---- */}
      <Section icon={<ClipboardList size={17} />} title="Weekly updates & the team check-in">
        <div className="space-y-2.5">
          <Feature label="Weekly check-in (one card per team)">
            A manager files <strong>one card for their whole team</strong>: a single weekly narrative
            (progress, plans, releases, concerns, blockers, risks) — not one card per project. On the
            same card they can change any project's status; each change needs a reason and drops a
            marker on the timeline when posted. This is the only weekly update flow — there's no
            separate per-project "new update" button.
          </Feature>
          <Feature label="Check-in status (Admin & Leadership)">
            The Weekly Updates screen shows a <strong>Team check-ins</strong> panel — who has filed
            this week's check-in and who's still <strong>Pending</strong> — with a count, so you can
            chase the stragglers at a glance. Click a team to open or amend its check-in.
          </Feature>
          <Feature label="Comments & discussion">
            Anyone can comment on an update, so it becomes a leadership ↔ manager thread.
          </Feature>
          <Feature label="Leadership edits, nothing lost">
            Leadership can refine an update; the original wording is preserved in the update's edit
            history.
          </Feature>
          <Feature label="Status changes are audited">
            Every status change captures a mandatory reason, kept as an audit trail on the project.
          </Feature>
        </div>
      </Section>

      {/* ---- Project types ---- */}
      <Section icon={<Tag size={17} />} title="Project types">
        <p className="text-sm text-slate-600">Every project is one of three types:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <TypeChip t="enhancement" />
          <TypeChip t="initiative" />
          <TypeChip t="technical" />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Set the type on the project form. In a team view you can <strong>filter to one type at a
          time</strong>, and the type shows as a coloured bar and square on the timeline and a badge
          on each card.
        </p>
      </Section>

      {/* ---- Roles ---- */}
      <Section icon={<Users size={17} />} title="Roles & access rules" defaultOpen>
        <div className="space-y-2 text-sm">
          <RoleRow role="Admin" color="#c8102e">
            Full access to everything — every team and project, all tools, add/edit teams and
            projects, set the default rate card and T-shirt scale.
          </RoleRow>
          <RoleRow role="Leadership" color="#7c3aed">
            Full access too — the same rights as Admin across every team, plus commenting on updates.
            This is the portfolio-owner view.
          </RoleRow>
          <RoleRow role="Manager" color="#0d9488">
            Full rights <strong>within their own team</strong> — add / edit / delete projects, post
            updates and weekly check-ins, baseline plans, log scope changes, and set their team's
            estimator scale and capacity settings. Read-only on other teams. <strong>Does not see money</strong>.
          </RoleRow>
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-slate-600">
          <p>• <strong>Money is Admin + Leadership only</strong> — the Budget page, project costs, rate cards and "Est. cost" are hidden from Managers.</p>
          <p>• <strong>Everyone</strong> can comment on updates.</p>
          <p>• Every <strong>status change</strong> requires a reason (kept as an audit trail).</p>
          <p>• Each team's <strong>rate card</strong> is independent (Admin/Leadership set it) — no two teams have to share rates.</p>
        </div>
        <p className="mt-2 text-xs text-slate-400">Switch roles with the "Viewing as" dropdown at the bottom-left.</p>
      </Section>

      <Section icon={<Lightbulb size={17} className="text-blue-600" />} title="Capacity Planning — how to use it" accent="#2563eb">
        <p className="text-sm text-slate-600">
          It answers one question: <strong>do we have enough people to finish everything we've taken
          on — and if not, when does it get tight?</strong>
        </p>
        <ol className="mt-3 space-y-2.5">
          <Step n={1} title="Read the top numbers">
            <strong>People needed</strong> vs <strong>people we have</strong> is your gap.
            <strong> Coverage</strong> under 100% means you're short.
          </Step>
          <Step n={2} title="Look at the chart">
            Each bar is a month. <strong>Red months need more people than you have</strong> — that's
            where things slip first.
          </Step>
          <Step n={3} title="See which teams are short">
            The coloured bars show where the gap is by team.
          </Step>
          <Step n={4} title="Close the gaps — 4 choices">
            <strong>Add</strong> people, <strong>move</strong> people from a team with slack,
            <strong> push</strong> some start dates, or <strong>drop / postpone</strong> some work.
          </Step>
        </ol>
        <button
          onClick={() => onNavigate({ k: 'capacity' })}
          className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Open Capacity Planning →
        </button>
      </Section>

      <Section icon={<MessageSquare size={17} />} title="FAQ">
        <div className="space-y-3">
          <Faq q="Why can't I see edit buttons on a team?">
            You're a Manager viewing a team that isn't yours — you have full rights on your own team
            only. Admin and Leadership can edit every team. Check the "Viewing as" dropdown.
          </Faq>
          <Faq q="How do managers post their weekly update?">
            One <strong>Weekly check-in</strong> per team: a single narrative plus any project status
            changes, all on one card. Opening it from a team scopes it to that team. Admin and
            Leadership see a Team check-ins panel showing who's done and who's pending this week.
          </Faq>
          <Faq q="Can each team have its own rates?">
            Yes. Every team has its own rate card (plus T-shirt scale and capacity settings). Rate cards
            hold money, so <strong>Admin/Leadership</strong> set them from the team's Planning tools row;
            a team starts from the organisation default (Budget page) until customised. Budgets roll up
            on each team's own rates. Managers set the non-money plan settings (estimator scale, capacity).
          </Faq>
          <Faq q="What are CapEx and OpEx, and where do I see the split?">
            Every project is classified <strong>CapEx</strong> (capital — building new assets) or
            <strong> OpEx</strong> (operating — run &amp; maintain) on the project form. The Budget page
            shows a CapEx vs. OpEx breakdown — forecast, spend and project count for each — so you can
            report on where the money goes.
          </Faq>
          <Faq q="What is the Backlog?">
            A project with no start/end date is a <strong>Backlog</strong> item — staged but not on any
            timeline. It's listed in a Backlog section on the team page (and a portfolio-wide rollup on
            the Overview) with its size, points and priority. Click <strong>Schedule</strong>, set both
            dates, and it moves onto the timeline automatically.
          </Faq>
          <Faq q="How do I size a new project?">
            On the project form, either pick a <strong>T-shirt size</strong> (which fills the points) or
            type <strong>story points</strong> directly — one or the other.
          </Faq>
          <Faq q="Where do I land when I switch roles?">
            A <strong>Manager</strong> lands on their own team's page (with New program, Weekly check-in
            and Import to hand). <strong>Admin & Leadership</strong> land on the portfolio Overview, with
            Alerts, Capacity Planning and Reports & KPIs one click away at the top.
          </Faq>
          <Faq q="Can I see every project that was ever blocked?">
            Yes — on a team view or the Portfolio Timeline, use the <strong>"Ever flagged"</strong>
            filter and pick a marker (Blocked, On hold, Cancelled, Postponed, Descoped or Scope
            changed). It shows every project that carried that marker at <em>any</em> point in its life,
            even if it isn't in that state now.
          </Faq>
          <Faq q="How do I tell a project's type on the timeline?">
            In a team view the bar and the square on each row are coloured by type (see the legend
            above the chart), and each card shows a type badge. Use "Filter by type" to show one type
            at a time.
          </Faq>
          <Faq q="What does the Budget screen show?">
            Each team's fund, and every program's estimated budget, spend-to-date, forecast at
            completion and variance — rolled up program → team → portfolio. Green = under, red = over.
          </Faq>
          <Faq q="Estimator vs Capacity Calculator?">
            <strong>Estimator</strong>: "when will it be done, and roughly what will it cost?" (you give
            the work and the team). <strong>Capacity Calculator</strong>: "how many people to hit this
            date?" (the flip side).
          </Faq>
          <Faq q="Can leadership change what a manager wrote?">
            Yes — and the original wording is kept in the update's edit history, so nothing is lost.
          </Faq>
          <Faq q="Where is my data stored?">
            Live to your team's database, so it's shared and persists across devices and reloads.
          </Faq>
          <Faq q="How do I load the sample content again?">
            "Reset sample data" at the bottom-left replaces everything with the built-in examples.
          </Faq>
        </div>
      </Section>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
  defaultOpen,
  accent,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  defaultOpen?: boolean
  accent?: string
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 bg-white shadow-sm"
      style={accent ? { borderLeftWidth: 3, borderLeftColor: accent } : undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-base font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="text-slate-400">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown size={18} className="text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 p-4 pt-3">{children}</div>
    </details>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {n}
      </span>
      <div>
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-sm text-slate-600">{children}</div>
      </div>
    </li>
  )
}

function ScreenCard({
  icon,
  color,
  title,
  children,
  onClick,
}: {
  icon: ReactNode
  color: string
  title: string
  children: ReactNode
  onClick?: () => void
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          {icon}
        </span>
        <span className="font-semibold text-slate-900">{title}</span>
      </div>
      <p className="text-sm text-slate-600">{children}</p>
    </>
  )
  return onClick ? (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm"
    >
      {inner}
    </button>
  ) : (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-left">{inner}</div>
  )
}

/** A tool / feature row: a bold label with a short description. */
function Feature({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon ?? <ChevronDown size={15} className="-rotate-90" />}</span>
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{label}.</span> {children}
      </p>
    </div>
  )
}

function RoleRow({ role, color, children }: { role: string; color: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${color}1a`, color }}>
        {role}
      </span>
      <span className="text-slate-600">{children}</span>
    </div>
  )
}

/** A small coloured chip naming a project type (matches the timeline colours). */
function TypeChip({ t }: { t: 'enhancement' | 'initiative' | 'technical' }) {
  const color = PROJECT_TYPE_COLORS[t]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {PROJECT_TYPE_LABELS[t]}
    </span>
  )
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-800">{q}</div>
      <div className="mt-0.5 text-sm text-slate-600">{children}</div>
    </div>
  )
}
