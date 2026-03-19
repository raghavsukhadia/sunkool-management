"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function ManagementSignOut() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      className="w-full min-h-[44px] gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </Button>
  )
}
