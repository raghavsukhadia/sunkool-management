"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Lightbulb, RefreshCw, Send, ShieldAlert, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getSmartInsightData,
  sendSmartInsightOpsBrief,
  type SmartInsightPayload,
} from "@/app/actions/smart-insight"

type Timeframe = "today" | "next24h" | "week"

function KpiCard({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string
  value: number | string
  sub: string
  tone?: "slate" | "amber" | "red" | "emerald" | "indigo"
}) {
  const toneClasses = {
    slate: "from-slate-50 to-white ring-slate-200",
    amber: "from-amber-50 to-white ring-amber-200",
    red: "from-red-50 to-white ring-red-200",
    emerald: "from-emerald-50 to-white ring-emerald-200",
    indigo: "from-indigo-50 to-white ring-indigo-200",
  }[tone]

  return (
    <div className={cn("rounded-2xl bg-gradient-to-b p-4 shadow-sm ring-1", toneClasses)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-3xl font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  )
}

function PriorityPill({ value }: { value: "High" | "Medium" | "Low" }) {
  const cls =
    value === "High"
      ? "bg-red-50 text-red-700 ring-red-200"
      : value === "Medium"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
  return <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1", cls)}>{value}</span>
}

export default function SmartInsightPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("today")
  const [data, setData] = useState<SmartInsightPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendMessage, setSendMessage] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      setError(null)
      const res = await getSmartInsightData(timeframe)
      if (res.success) setData(res.data)
      else setError(res.error)
      setLoading(false)
      setRefreshing(false)
    },
    [timeframe]
  )

  useEffect(() => {
    void load()
  }, [load])

  const missionLine = useMemo(() => {
    if (!data) return ""
    const { productionBacklogUnits, dispatchReadyOrders, overdueEtaShipments } = data.headlineKpis
    return `Clear ${productionBacklogUnits} backlog units, move ${dispatchReadyOrders} ready orders to dispatch, and resolve ${overdueEtaShipments} shipment risks.`
  }, [data])

  const sendOpsBrief = async () => {
    setSendMessage(null)
    setSending(true)
    const res = await sendSmartInsightOpsBrief(timeframe)
    setSending(false)
    setSendMessage(res.success ? `Ops brief sent to ${res.sent} recipients.` : res.error)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-md">
        <div className="grid gap-4 p-4 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-300/20 p-1.5">
                <Lightbulb className="h-4 w-4 text-amber-300" />
              </div>
              <h2 className="text-lg font-bold tracking-wide">Smart Insight</h2>
            </div>
            <p className="mt-2 text-xs text-slate-300">Daily auto-ops planning engine for Production and Dispatch.</p>
            {data && (
              <p className="mt-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                {missionLine}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <div className="rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
              {([
                { key: "today", label: "Today" },
                { key: "next24h", label: "Next 24h" },
                { key: "week", label: "This Week" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTimeframe(t.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    timeframe === t.key ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-200 hover:bg-white/10"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void load(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={sendOpsBrief}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
            >
              {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Ops Brief
            </button>
          </div>
        </div>
        {sendMessage && <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-200">{sendMessage}</p>}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center text-sm text-slate-500">
          Loading Smart Insight...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Backlog Units" value={data.headlineKpis.productionBacklogUnits} sub="Pending production output" tone="indigo" />
            <KpiCard label="Dispatch Ready" value={data.headlineKpis.dispatchReadyOrders} sub="Can be moved to dispatch" tone="emerald" />
            <KpiCard label="Overdue ETA" value={data.headlineKpis.overdueEtaShipments} sub="Need immediate dispatch follow-up" tone="red" />
            <KpiCard label="Partial Delivery Risk" value={data.headlineKpis.partialDeliveryRiskCount} sub="Orders with delivery + cash pressure" tone="amber" />
            <KpiCard
              label="Plan vs Complete"
              value={`${data.headlineKpis.plannedVsCompletedToday.completed}/${data.headlineKpis.plannedVsCompletedToday.planned}`}
              sub="Today production record completion"
              tone="slate"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-900">What can be done today</h3>
                </div>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  Top {Math.min(10, data.todayPlan.length)}
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {data.todayPlan.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{item.title}</p>
                      <PriorityPill value={item.priority} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600">{item.reason}</p>
                    <p className="mt-2 text-[11px] font-medium text-slate-500">Ref: {item.targetRef} · Team: {item.team}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Team Execution Split</h3>
              </div>
              <div className="space-y-2">
                {data.teamLoadSummary.map((team) => (
                  <div key={team.team} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{team.team}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                        <p className="text-slate-500">Pending</p>
                        <p className="text-lg font-bold text-slate-900">{team.pending}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                        <p className="text-slate-500">Critical</p>
                        <p className="text-lg font-bold text-red-600">{team.critical}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Data source: live OMS flow {data.fromSnapshot ? "(snapshot)" : "(computed now)"} · Generated {new Date(data.generatedAt).toLocaleString("en-IN")}
              </p>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-900">Bottlenecks and Risks</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.criticalRisks.length === 0 ? (
                  <p className="text-xs text-slate-500">No critical risks identified in current window.</p>
                ) : (
                  data.criticalRisks.map((risk) => (
                    <div key={risk.id} className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50 to-white p-3">
                      <p className="text-xs font-semibold text-red-700">{risk.title}</p>
                      <p className="mt-1 text-[11px] text-red-600">{risk.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Auto-Ops Recommendations</h3>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {data.autoOpsRecommendations.map((rec) => (
                  <div key={rec.id} className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{rec.action}</p>
                      <PriorityPill value={rec.priority} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
