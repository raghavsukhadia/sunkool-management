import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, Users } from "lucide-react"

export default function ManagementPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Management</h1>
      <p className="text-gray-600 mb-8">Manage core data for your system</p>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2 text-blue-600" />
              Products Details
            </CardTitle>
            <CardDescription>Manage your product catalog and inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/management/products">
              <Button className="w-full">Manage Products</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-600">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Truck className="w-5 h-5 mr-2 text-green-600" />
              Courier Company
            </CardTitle>
            <CardDescription>Manage shipping and courier partners</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/management/courier">
              <Button className="w-full">Manage Couriers</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-600">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              Customer
            </CardTitle>
            <CardDescription>Manage customer information and contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/management/customers">
              <Button className="w-full">Manage Customers</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

