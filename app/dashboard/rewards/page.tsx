"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Award, TrendingUp, Users, Gift, Plus, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Reward {
  id: string
  points: number
  reason?: string
  created_at: string
  order_id?: string | null
  distributors: {
    name: string
    email?: string
  }
  orders?: {
    internal_order_number: string
  }
  profiles: {
    full_name: string
  }
}

interface DistributorPoints {
  distributor_id: string
  name: string
  email?: string
  total_points: number
  reward_count: number
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [distributorPoints, setDistributorPoints] = useState<DistributorPoints[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchRewardsData()
  }, [])

  const fetchRewardsData = async () => {
    try {
      // Fetch all rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("rewards")
        .select(`
          *,
          distributors (name, email),
          orders (internal_order_number),
          profiles (full_name)
        `)
        .order("created_at", { ascending: false })

      if (rewardsError) throw rewardsError

      // Calculate distributor points
      const pointsMap = new Map<string, DistributorPoints>()
      rewardsData?.forEach(reward => {
        const distId = reward.distributor_id
        if (!pointsMap.has(distId)) {
          pointsMap.set(distId, {
            distributor_id: distId,
            name: reward.distributors?.name || "Unknown",
            email: reward.distributors?.email,
            total_points: 0,
            reward_count: 0,
          })
        }
        const current = pointsMap.get(distId)!
        current.total_points += reward.points
        current.reward_count += 1
      })

      setRewards(rewardsData || [])
      setDistributorPoints(Array.from(pointsMap.values()).sort((a, b) => b.total_points - a.total_points))
    } catch (error) {
      console.error("Error fetching rewards:", error)
    } finally {
      setLoading(false)
    }
  }

  const totalPoints = rewards.reduce((sum, r) => sum + r.points, 0)
  const totalDistributors = distributorPoints.length
  const avgPointsPerDistributor = totalDistributors > 0 ? Math.round(totalPoints / totalDistributors) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Award className="h-8 w-8 text-amber-600" />
            Rewards Management
          </h1>
          <p className="text-slate-600 mt-2">
            Track and manage distributor reward points
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Reward
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalPoints.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">All distributors</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Active Distributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalDistributors}</div>
            <p className="text-xs text-slate-500 mt-1">With reward points</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Avg Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{avgPointsPerDistributor}</div>
            <p className="text-xs text-slate-500 mt-1">Per distributor</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Total Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{rewards.length}</div>
            <p className="text-xs text-slate-500 mt-1">Entries recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Reward Form */}
      {showAddForm && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Add New Reward</CardTitle>
            <CardDescription>Award points to a distributor</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="distributor">Distributor</Label>
                  <Input id="distributor" placeholder="Select distributor" />
                  <p className="text-xs text-slate-500 mt-1">Feature coming soon - Select from distributors list</p>
                </div>
                <div>
                  <Label htmlFor="points">Points</Label>
                  <Input id="points" type="number" placeholder="100" />
                </div>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" placeholder="Order incentive, referral bonus, etc." />
              </div>
              <div>
                <Label htmlFor="order">Link to Order (Optional)</Label>
                <Input id="order" placeholder="Order number" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
                  <Gift className="h-4 w-4 mr-2" />
                  Award Points
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Distributor Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            Distributor Leaderboard
          </CardTitle>
          <CardDescription>Top distributors by reward points</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-500 py-4">Loading leaderboard...</p>
          ) : distributorPoints.length === 0 ? (
            <div className="text-center py-8">
              <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No rewards recorded yet</p>
              <p className="text-sm text-slate-400 mt-1">Start awarding points to distributors</p>
            </div>
          ) : (
            <div className="space-y-3">
              {distributorPoints.map((dist, index) => (
                <div
                  key={dist.distributor_id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                      ${index === 0 ? 'bg-amber-500 text-white' : 
                        index === 1 ? 'bg-slate-400 text-white' : 
                        index === 2 ? 'bg-orange-600 text-white' : 
                        'bg-slate-200 text-slate-600'}
                    `}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{dist.name}</p>
                      {dist.email && (
                        <p className="text-sm text-slate-500">{dist.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-amber-600">{dist.total_points}</div>
                    <p className="text-xs text-slate-500">{dist.reward_count} rewards</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Rewards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-blue-600" />
            Recent Rewards
          </CardTitle>
          <CardDescription>Latest reward point awards</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-500 py-4">Loading rewards...</p>
          ) : rewards.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No rewards recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rewards.slice(0, 10).map(reward => (
                <div
                  key={reward.id}
                  className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{reward.distributors?.name}</span>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        +{reward.points} points
                      </Badge>
                    </div>
                    {reward.reason && (
                      <p className="text-sm text-slate-600 mb-1">{reward.reason}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>By {reward.profiles?.full_name}</span>
                      <span>•</span>
                      <span>{new Date(reward.created_at).toLocaleDateString()}</span>
                      {reward.orders && (
                        <>
                          <span>•</span>
                          <Link
                            href={`/dashboard/orders/${reward.order_id}`}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {reward.orders.internal_order_number}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

