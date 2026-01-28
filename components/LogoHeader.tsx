"use client"

import Link from "next/link"
import SunkoolLogo from "@/components/SunkoolLogo"

export default function LogoHeader() {
  return (
    <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
      <SunkoolLogo variant="dark" size="md" />
      <div className="flex flex-col">
        <span className="font-bold text-slate-900 text-sm">Sunkool</span>
        <span className="text-slate-500 text-xs">Order Management</span>
      </div>
    </Link>
  )
}
