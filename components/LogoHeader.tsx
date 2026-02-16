"use client"

import Link from "next/link"
import SunkoolLogo from "@/components/SunkoolLogo"

export default function LogoHeader() {
  return (
    <Link href="/dashboard" className="flex items-center hover:opacity-90 transition-opacity">
      <SunkoolLogo variant="dark" size="md" />
    </Link>
  )
}
