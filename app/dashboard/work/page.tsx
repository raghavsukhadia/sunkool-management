import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Factory, DollarSign, Bell } from "lucide-react"

type WorkTile = {
  href: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  mobileHidden?: boolean
}

const workTiles: WorkTile[] = [
  {
    href: "/dashboard/production",
    title: "Production",
    description: "Production queue and item-wise visibility",
    icon: Factory,
    accent: "border-l-blue-600",
  },
  {
    href: "/dashboard/follow-up",
    title: "Follow Up",
    description: "Payment follow-ups and outstanding amounts",
    icon: DollarSign,
    accent: "border-l-amber-600",
  },
  {
    href: "/dashboard/notifications",
    title: "Notifications",
    description: "WhatsApp alerts and notification history",
    icon: Bell,
    accent: "border-l-slate-600",
    mobileHidden: true,
  },
]

export default function WorkHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Work</h1>
        <p className="text-slate-500 font-medium mt-1">Production, follow-ups, and notifications</p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {workTiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link key={tile.href} href={tile.href} className={`block min-h-[44px] ${tile.mobileHidden ? "hidden lg:block" : ""}`}>
              <Card className={`h-full border-l-4 ${tile.accent} transition-shadow hover:shadow-md cursor-pointer`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-slate-600" />
                    {tile.title}
                  </CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
