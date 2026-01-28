"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Edit2, Mail, Phone, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Distributor {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  notes?: string
  is_active: boolean
  created_at: string
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    notes: "",
  })
  const supabase = createClient()

  useEffect(() => {
    fetchDistributors()
  }, [])

  const fetchDistributors = async () => {
    try {
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .order("name", { ascending: true })

      if (error) throw error
      setDistributors(data || [])
    } catch (error) {
      console.error("Error fetching distributors:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from("distributors")
        .insert({
          ...formData,
          is_active: true,
        })

      if (error) throw error

      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        contact_person: "",
        notes: "",
      })
      setShowAddForm(false)
      fetchDistributors()
    } catch (error) {
      console.error("Error creating distributor:", error)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("distributors")
        .update({ is_active: !currentStatus })
        .eq("id", id)

      if (error) throw error
      fetchDistributors()
    } catch (error) {
      console.error("Error updating distributor:", error)
    }
  }

  const activeDistributors = distributors.filter(d => d.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            Distributors
          </h1>
          <p className="text-slate-600 mt-2">
            Manage distributor accounts and partners
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Distributor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Total Distributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{distributors.length}</div>
            <p className="text-xs text-slate-500 mt-1">In database</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeDistributors}</div>
            <p className="text-xs text-slate-500 mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-slate-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{distributors.length - activeDistributors}</div>
            <p className="text-xs text-slate-500 mt-1">Not active</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg">Add New Distributor</CardTitle>
            <CardDescription>Create a new distributor account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Distributor Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ABC Distributors"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@distributor.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Business Street, City, State, PIN"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional information..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Distributor
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Distributors List */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-slate-500">Loading distributors...</p>
            </CardContent>
          </Card>
        ) : distributors.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No distributors found</p>
                <p className="text-sm text-slate-400 mt-1">Add your first distributor to get started</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          distributors.map(distributor => (
            <Card key={distributor.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-slate-900">{distributor.name}</h3>
                      <Badge variant={distributor.is_active ? "default" : "secondary"}>
                        {distributor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {distributor.contact_person && (
                      <p className="text-sm text-slate-600">Contact: {distributor.contact_person}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={distributor.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleActive(distributor.id, distributor.is_active)}
                    >
                      {distributor.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {distributor.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="h-4 w-4" />
                      <span>{distributor.email}</span>
                    </div>
                  )}
                  {distributor.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="h-4 w-4" />
                      <span>{distributor.phone}</span>
                    </div>
                  )}
                  {distributor.address && (
                    <div className="flex items-start gap-2 text-slate-600 col-span-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span>{distributor.address}</span>
                    </div>
                  )}
                </div>
                {distributor.notes && (
                  <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 font-semibold mb-1">Notes</p>
                    <p className="text-sm text-slate-700">{distributor.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
