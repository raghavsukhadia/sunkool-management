"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  getAppUsers,
  createAppUser,
  updateUserDetails,
  updateUserPassword,
  deleteAppUser,
  isCurrentUserAdmin,
} from "@/app/actions/users"
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  UserCog,
  Eye,
  EyeOff,
  Shield,
  User,
} from "lucide-react"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const addSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").or(z.literal("")).optional(),
})

type AddFormValues = z.infer<typeof addSchema>
type EditFormValues = z.infer<typeof editSchema>

interface AppUser {
  id: string
  email: string
  name: string
  phone: string
  role: "admin" | "user"
  created_at: string
  last_sign_in_at: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const router = useRouter()

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const [showAddForm, setShowAddForm] = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [isAddSubmitting, setIsAddSubmitting] = useState(false)
  const [showAddPassword, setShowAddPassword] = useState(false)

  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

  const addForm = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  })

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", phone: "", password: "" },
  })

  useEffect(() => {
    async function init() {
      const admin = await isCurrentUserAdmin()
      setIsAdmin(admin)
      setAccessChecked(true)
      if (!admin) {
        router.replace("/dashboard/management")
        return
      }
      await loadUsers()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAppUsers()
      if (result.success && result.data) {
        setUsers(result.data as AppUser[])
      } else {
        setError(result.error || "Failed to load users")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  // ── Add user ────────────────────────────────────────────────────────────────
  const onAddSubmit = async (data: AddFormValues) => {
    setIsAddSubmitting(true)
    setError(null)
    try {
      const result = await createAppUser(data)
      if (result.success) {
        showSuccess("User created successfully!")
        addForm.reset()
        setShowAddForm(false)
        setAddSheetOpen(false)
        await loadUsers()
      } else {
        setError(result.error || "Failed to create user")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsAddSubmitting(false)
    }
  }

  // ── Edit user ───────────────────────────────────────────────────────────────
  const openEdit = (u: AppUser) => {
    setEditingUser(u)
    editForm.reset({ name: u.name, phone: u.phone, password: "" })
    setShowEditPassword(false)
    setEditSheetOpen(true)
  }

  const onEditSubmit = async (data: EditFormValues) => {
    if (!editingUser) return
    setIsEditSubmitting(true)
    setError(null)
    try {
      const detailsRes = await updateUserDetails(editingUser.id, { name: data.name, phone: data.phone })
      if (!detailsRes.success) {
        setError(detailsRes.error || "Failed to update user")
        return
      }
      if (data.password && data.password.length >= 6) {
        const passRes = await updateUserPassword(editingUser.id, data.password)
        if (!passRes.success) {
          setError(passRes.error || "Failed to update password")
          return
        }
      }
      showSuccess("User updated successfully!")
      setEditSheetOpen(false)
      setEditingUser(null)
      await loadUsers()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsEditSubmitting(false)
    }
  }

  // ── Delete user ─────────────────────────────────────────────────────────────
  const handleDelete = async (u: AppUser) => {
    if (!confirm(`Delete "${u.name || u.email}"? This cannot be undone.`)) return
    setError(null)
    try {
      const result = await deleteAppUser(u.id)
      if (result.success) {
        showSuccess("User deleted successfully!")
        await loadUsers()
      } else {
        setError(result.error || "Failed to delete user")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true
    const t = searchTerm.toLowerCase()
    return u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.phone.toLowerCase().includes(t)
  })

  // Show nothing while checking access (avoids flash before redirect)
  if (!accessChecked) return null

  return (
    <div className="space-y-4 lg:space-y-6 pb-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 lg:mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 min-h-[44px] lg:min-h-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Users</h1>
          <p className="text-gray-600 mt-1.5 text-sm">Manage application users and access</p>
        </div>

        <div className="flex gap-2">
          {/* Desktop add button */}
          <Button
            onClick={() => { setShowAddForm(true); addForm.reset(); setError(null) }}
            className="hidden lg:inline-flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>

          {/* Mobile add button → bottom Sheet */}
          <Button
            onClick={() => { addForm.reset(); setError(null); setAddSheetOpen(true) }}
            className="lg:hidden flex items-center gap-2 shadow-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-4 text-sm text-green-700 bg-green-50 border-l-4 border-green-500 rounded-r-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Add form (desktop inline card) ───────────────────────────────── */}
      {showAddForm && (
        <Card className="hidden lg:block border-2 border-orange-100 shadow-md">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Add New User
                </CardTitle>
                <CardDescription className="mt-1">Fill in the details to create a new application user</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAddForm(false); addForm.reset(); setError(null) }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={addForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Rahul Sharma" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 99999 99999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={addForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email / User ID *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="user@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showAddPassword ? "text" : "password"}
                              placeholder="Min. 6 characters"
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowAddPassword(p => !p)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-3 pt-2 border-t">
                  <Button type="submit" disabled={isAddSubmitting} className="px-6">
                    {isAddSubmitting ? "Creating..." : "Create User"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowAddForm(false); addForm.reset(); setError(null) }}
                    className="border-gray-300"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Mobile: Add User Sheet ────────────────────────────────────────── */}
      <Sheet open={addSheetOpen} onOpenChange={(o) => { setAddSheetOpen(o); if (!o) addForm.reset() }}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New User</SheetTitle>
            <SheetDescription>Create a new application user account</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Rahul Sharma" className="min-h-[44px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email / User ID *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@company.com" className="min-h-[44px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 99999 99999" className="min-h-[44px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showAddPassword ? "text" : "password"}
                            placeholder="Min. 6 characters"
                            className="min-h-[44px] pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAddPassword(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isAddSubmitting} className="flex-1 min-h-[44px]">
                    {isAddSubmitting ? "Creating..." : "Create User"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => { setAddSheetOpen(false); addForm.reset() }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 min-h-[44px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Users list ───────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
            <div className="p-1.5 bg-orange-100 rounded-md">
              <UserCog className="w-4 h-4 text-orange-600" />
            </div>
            All Users
            <span className="text-sm font-normal text-gray-500 ml-1">({filteredUsers.length})</span>
          </CardTitle>
          <CardDescription>View and manage all application users</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-3" />
              <p className="text-sm">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchTerm ? "No users found matching your search." : "No users yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="lg:hidden p-4 space-y-3">
                {filteredUsers.map((u) => (
                  <Card key={u.id} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{u.name || "—"}</p>
                            <Badge
                              variant={u.role === "admin" ? "default" : "secondary"}
                              className="text-xs gap-1"
                            >
                              {u.role === "admin"
                                ? <><Shield className="w-3 h-3" />Admin</>
                                : <><User className="w-3 h-3" />User</>
                              }
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">{u.email}</p>
                          {u.phone && <p className="text-xs text-gray-500 mt-0.5">{u.phone}</p>}
                          {u.last_sign_in_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Last login: {new Date(u.last_sign_in_at).toLocaleDateString("en-IN")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openEdit(u)}
                            title="Edit user"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {u.role !== "admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(u)}
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Phone</th>
                      <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Role</th>
                      <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Last Login</th>
                      <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-orange-50/30 transition-colors">
                        <td className="p-4">
                          <span className="text-sm font-medium text-gray-900">{u.name || "—"}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-gray-600">{u.email}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-gray-600">{u.phone || "—"}</span>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={u.role === "admin" ? "default" : "secondary"}
                            className="text-xs gap-1"
                          >
                            {u.role === "admin"
                              ? <><Shield className="w-3 h-3" />Admin</>
                              : <><User className="w-3 h-3" />User</>
                            }
                          </Badge>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-gray-500">
                            {u.last_sign_in_at
                              ? new Date(u.last_sign_in_at).toLocaleDateString("en-IN")
                              : "Never"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(u)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              title="Edit user"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {u.role !== "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(u)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Edit User Sheet (right side, all screen sizes) ───────────────── */}
      <Sheet open={editSheetOpen} onOpenChange={(o) => {
        setEditSheetOpen(o)
        if (!o) { setEditingUser(null); editForm.reset() }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit User</SheetTitle>
            <SheetDescription>Update details or reset password</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editingUser && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border text-sm text-gray-600">
                <span className="font-medium">Email:</span>{" "}
                <span className="text-gray-900">{editingUser.email}</span>
              </div>
            )}
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full Name" className="min-h-[44px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 99999 99999" className="min-h-[44px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showEditPassword ? "text" : "password"}
                            placeholder="Leave blank to keep unchanged"
                            className="min-h-[44px] pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>Min. 6 characters. Leave blank to keep current password.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2 border-t">
                  <Button type="submit" disabled={isEditSubmitting} className="flex-1 min-h-[44px]">
                    {isEditSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => { setEditSheetOpen(false); setEditingUser(null); editForm.reset() }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
