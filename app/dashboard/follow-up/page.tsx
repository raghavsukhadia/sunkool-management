"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { updatePaymentFollowup, ensureAllPaymentFollowups, getPaymentFollowupsForPage } from "@/app/actions/orders"
import Link from "next/link"

interface PaymentFollowup {
  id: string
  order_id: string
  orders: {
    internal_order_number: string
    customers: {
      name: string
    }
  }
  followup_date: string
  payment_received: boolean
  payment_date?: string
  notes?: string
}

type FollowupForm = { payment_received: boolean; payment_date: string; notes: string }

export default function FollowUpPage() {
  const [followups, setFollowups] = useState<PaymentFollowup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending")
  const [followupFormById, setFollowupFormById] = useState<Record<string, FollowupForm>>({})
  const [savingFollowupId, setSavingFollowupId] = useState<string | null>(null)

  const fetchFollowups = async () => {
    try {
      const result = await getPaymentFollowupsForPage()
      if (result.success && result.data) {
        setFollowups(result.data as unknown as PaymentFollowup[])
      } else {
        console.error("Error fetching followups:", result.error)
      }
    } catch (error) {
      console.error("Error fetching followups:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      await ensureAllPaymentFollowups()
      await fetchFollowups()
    }
    load()
  }, [])

  const handleSaveFollowup = async (followupId: string, form: FollowupForm) => {
    try {
      setSavingFollowupId(followupId)
      await updatePaymentFollowup(
        followupId,
        form.payment_received,
        form.payment_date || undefined,
        form.notes || undefined
      )
      await fetchFollowups()
    } catch (error) {
      console.error("Error updating followup:", error)
    } finally {
      setSavingFollowupId(null)
    }
  }

  const filteredFollowups = followups.filter(f => {
    if (filter === "pending") return !f.payment_received
    if (filter === "completed") return f.payment_received
    return true
  })

  const overdueFollowups = followups.filter(f => {
    const today = new Date()
    const followupDate = new Date(f.followup_date)
    return !f.payment_received && followupDate < today
  }).length

  const pendingFollowups = followups.filter(f => !f.payment_received).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Payment Follow-ups</h1>
        <p className="text-slate-600 mt-2">
          Track and manage payment follow-ups. When payment is not received within 14 days of dispatch, a follow-up is created for the order.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Total Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{followups.length}</div>
            <p className="text-xs text-slate-500 mt-1">One follow-up per order after 14 days without payment</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingFollowups}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueFollowups}</div>
            <p className="text-xs text-slate-500 mt-1">Past followup date</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className="gap-2"
        >
          All ({followups.length})
        </Button>
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Pending ({pendingFollowups})
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Completed ({followups.filter(f => f.payment_received).length})
        </Button>
      </div>

      {/* Followups List */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-slate-500">Loading follow-ups...</p>
            </CardContent>
          </Card>
        ) : filteredFollowups.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-slate-500">
                {filter === "completed" ? "No completed follow-ups" : "No pending follow-ups"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFollowups.map(followup => {
            const followupDate = new Date(followup.followup_date)
            const today = new Date()
            const isOverdue = !followup.payment_received && followupDate < today
            const daysUntil = Math.ceil((followupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

            return (
              <Card key={followup.id} className="border-slate-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/dashboard/orders/${followup.order_id}`}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {followup.orders?.internal_order_number}
                        </Link>
                        {followup.payment_received ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        Customer: <span className="font-medium">{followup.orders?.customers?.name}</span>
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Follow-up date: {followupDate.toLocaleDateString()}
                    {!followup.payment_received && (
                      <span className="ml-2 font-normal normal-case">
                        {daysUntil > 0 ? `(Due in ${daysUntil} days)` : `(${Math.abs(daysUntil)} days overdue)`}
                      </span>
                    )}
                  </p>

                  {(() => {
                    const paymentDateStr = followup.payment_date ? String(followup.payment_date).split("T")[0] : ""
                    const form: FollowupForm = followupFormById[followup.id] ?? {
                      payment_received: !!followup.payment_received,
                      payment_date: paymentDateStr,
                      notes: followup.notes || "",
                    }
                    return (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-slate-700">Payment received?</Label>
                          <div className="flex gap-4 mt-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`followup-${followup.id}-paid`}
                                checked={form.payment_received === true}
                                onChange={() => setFollowupFormById((prev) => ({
                                  ...prev,
                                  [followup.id]: { ...(prev[followup.id] ?? form), payment_received: true },
                                }))}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`followup-${followup.id}-paid`}
                                checked={form.payment_received === false}
                                onChange={() => setFollowupFormById((prev) => ({
                                  ...prev,
                                  [followup.id]: { ...(prev[followup.id] ?? form), payment_received: false },
                                }))}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">No</span>
                            </label>
                          </div>
                        </div>
                        {form.payment_received && (
                          <div>
                            <Label className="text-sm font-medium text-slate-700">Payment date</Label>
                            <Input
                              type="date"
                              value={form.payment_date}
                              onChange={(e) => setFollowupFormById((prev) => ({
                                ...prev,
                                [followup.id]: { ...(prev[followup.id] ?? form), payment_date: e.target.value },
                              }))}
                              className="mt-1.5 h-9 max-w-[200px]"
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-sm font-medium text-slate-700">Answer of follow-up</Label>
                          <textarea
                            value={form.notes}
                            onChange={(e) => setFollowupFormById((prev) => ({
                              ...prev,
                              [followup.id]: { ...(prev[followup.id] ?? form), notes: e.target.value },
                            }))}
                            placeholder="Outcome / notes from the follow-up call or action"
                            rows={3}
                            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <Button
                          onClick={() => handleSaveFollowup(followup.id, form)}
                          disabled={savingFollowupId === followup.id}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {savingFollowupId === followup.id ? (
                            <>
                              <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Save follow-up
                            </>
                          )}
                        </Button>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

