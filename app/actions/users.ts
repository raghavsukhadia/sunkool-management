"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"

const ADMIN_EMAIL = "raghav@sunkool.in"

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

export async function getAppUsers() {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized", data: null }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  if (!isAdmin) return { success: false, error: "Admin access required", data: null }

  const adminClient = createServiceRoleSupabaseClient()
  if (!adminClient) return { success: false, error: "Service not configured — SUPABASE_SERVICE_ROLE_KEY is missing", data: null }

  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return { success: false, error: error.message, data: null }

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.name as string) ?? "",
    phone: (u.user_metadata?.phone as string) ?? (u.phone ?? ""),
    role: u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }))

  users.sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1
    if (a.role !== "admin" && b.role === "admin") return 1
    const nameCompare = a.name.localeCompare(b.name)
    return nameCompare !== 0 ? nameCompare : a.email.localeCompare(b.email)
  })

  return { success: true, data: users, error: null }
}

export async function createAppUser(formData: {
  name: string
  email: string
  phone?: string
  password: string
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: "Admin access required" }
  }

  const adminClient = createServiceRoleSupabaseClient()
  if (!adminClient) return { success: false, error: "Service not configured" }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: formData.email.trim().toLowerCase(),
    password: formData.password,
    email_confirm: true,
    user_metadata: {
      name: formData.name.trim(),
      phone: formData.phone?.trim() ?? "",
    },
  })

  if (error) return { success: false, error: error.message }

  revalidatePath("/dashboard/management/users")
  return { success: true, data }
}

export async function updateUserDetails(userId: string, formData: {
  name: string
  phone?: string
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  const isSelf = user.id === userId
  if (!isAdmin && !isSelf) return { success: false, error: "Permission denied" }

  const adminClient = createServiceRoleSupabaseClient()
  if (!adminClient) return { success: false, error: "Service not configured" }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      name: formData.name.trim(),
      phone: formData.phone?.trim() ?? "",
    },
  })

  if (error) return { success: false, error: error.message }

  revalidatePath("/dashboard/management/users")
  return { success: true }
}

export async function updateUserPassword(userId: string, newPassword: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  const isSelf = user.id === userId
  if (!isAdmin && !isSelf) return { success: false, error: "Permission denied" }

  const adminClient = createServiceRoleSupabaseClient()
  if (!adminClient) return { success: false, error: "Service not configured" }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (error) return { success: false, error: error.message }

  return { success: true }
}

export async function deleteAppUser(userId: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Unauthorized" }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: "Admin access required" }
  }
  if (user.id === userId) {
    return { success: false, error: "Cannot delete your own account" }
  }

  const adminClient = createServiceRoleSupabaseClient()
  if (!adminClient) return { success: false, error: "Service not configured" }

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { success: false, error: error.message }

  revalidatePath("/dashboard/management/users")
  return { success: true }
}
