import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, Users, UserCog } from "lucide-react"
import { ManagementSignOut } from "@/components/dashboard/ManagementSignOut"
import { createClient } from "@/lib/supabase/server"

const ADMIN_EMAIL = "raghav@sunkool.in"

export default async function ManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">More</h1>
        <p className="text-gray-600">Manage data and account</p>
      </div>

      <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-600">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="flex items-center text-lg">
              <Package className="w-5 h-5 mr-2 text-blue-600" />
              Products
            </CardTitle>
            <CardDescription>Manage your product catalog and inventory</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 lg:p-6 lg:pt-0">
            <Link href="/dashboard/management/products">
              <Button className="w-full min-h-[44px]">Manage Products</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-600">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="flex items-center text-lg">
              <Truck className="w-5 h-5 mr-2 text-green-600" />
              Couriers
            </CardTitle>
            <CardDescription>Manage shipping and courier partners</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 lg:p-6 lg:pt-0">
            <Link href="/dashboard/management/courier">
              <Button className="w-full min-h-[44px]">Manage Couriers</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-600">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="flex items-center text-lg">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              Customers
            </CardTitle>
            <CardDescription>Manage customer information and contacts</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 lg:p-6 lg:pt-0">
            <Link href="/dashboard/management/customers">
              <Button className="w-full min-h-[44px]">Manage Customers</Button>
            </Link>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-orange-600">
            <CardHeader className="p-4 lg:p-6">
              <CardTitle className="flex items-center text-lg">
                <UserCog className="w-5 h-5 mr-2 text-orange-600" />
                Users
              </CardTitle>
              <CardDescription>Manage application users and passwords</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6 lg:pt-0">
              <Link href="/dashboard/management/users">
                <Button className="w-full min-h-[44px]">Manage Users</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="lg:hidden">
          <ManagementSignOut />
        </div>
      </div>
    </div>
  )
}
