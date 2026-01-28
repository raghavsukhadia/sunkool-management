"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { updatePaymentFollowup } from "@/app/actions/orders"
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

export default function FollowUpPage() {
  const [followups, setFollowups] = useState<PaymentFollowup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending")
  const supabase = createClient()

  useEffect(() => {
    fetchFollowups()
  }, [])

  const fetchFollowups = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_followups")
        .select(`
          *,
          orders (
            internal_order_number,
            customers (name)
          )
        `)
        .order("followup_date", { ascending: false })

      if (error) throw error
      setFollowups(data || [])
    } catch (error) {
      console.error("Error fetching followups:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (followupId: string) => {
    try {
      await updatePaymentFollowup(followupId, true, new Date().toISOString().split('T')[0])
      fetchFollowups()
    } catch (error) {
      console.error("Error updating followup:", error)
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
          Track and manage payment follow-ups for cash discount orders
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
            <p className="text-xs text-slate-500 mt-1">14-day cash discount orders</p>
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

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Followup Date</p>
                      <p className="font-semibold text-slate-900 flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {followupDate.toLocaleDateString()}
                      </p>
                      {!followup.payment_received && (
                        <p className="text-xs text-slate-500 mt-1">
                          {daysUntil > 0 ? `Due in ${daysUntil} days` : `${Math.abs(daysUntil)} days overdue`}
                        </p>
                      )}
                    </div>
                    {followup.payment_date && (
                      <div>
                        <p className="text-slate-600">Payment Date</p>
                        <p className="font-semibold text-slate-900 flex items-center gap-2 mt-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          {new Date(followup.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {followup.notes && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-600 font-semibold mb-1">Notes</p>
                      <p className="text-sm text-slate-700">{followup.notes}</p>
                    </div>
                  )}

                  {!followup.payment_received && (
                    <Button
                      onClick={() => handleMarkPaid(followup.id)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Paid
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

