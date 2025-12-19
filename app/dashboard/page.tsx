import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { 
  Package, 
  DollarSign, 
  Truck, 
  AlertCircle,
  Plus,
  Factory,
  Eye
} from "lucide-react"

export default async function DashboardPage() {
  // TODO: Fetch actual data from Supabase
  // For now, showing placeholder structure

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your operations.</p>
      </div>

      {/* Action Required Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Action Required</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-600 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Production Queue</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Factory className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <p className="text-xs text-gray-500 mb-3">Items need manufacturing</p>
              <Link href="/dashboard/production">
                <Button variant="outline" size="sm" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                  View Queue
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-600 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Payment Follow Ups</CardTitle>
              <div className="p-2 bg-amber-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <p className="text-xs text-gray-500 mb-3">Invoices need follow-up</p>
              <Link href="/dashboard/follow-up">
                <Button variant="outline" size="sm" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50">
                  View Follow-ups
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-600 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Dispatched</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <p className="text-xs text-gray-500">Orders in transit</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-600 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Missing Sales Order #</CardTitle>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
              <p className="text-xs text-gray-500">Orders missing SO number</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Pipeline & Payment Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Order Pipeline</CardTitle>
            <CardDescription>Status breakdown of all orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Pending</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">In Production</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Partial Dispatch</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Dispatched</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Delivered</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Payment Overview</CardTitle>
            <CardDescription>Payment status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Invoices Pending Payment</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Delivered (Unpaid)</span>
                <span className="font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700">Delivered & Paid</span>
                <span className="font-bold text-green-600">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/orders/new">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Create New Order
              </Button>
            </Link>
            <Link href="/dashboard/production">
              <Button variant="outline" className="border-gray-300 hover:bg-gray-50">
                <Factory className="w-4 h-4 mr-2" />
                View Production Queue
              </Button>
            </Link>
            <Link href="/dashboard/follow-up">
              <Button variant="outline" className="border-gray-300 hover:bg-gray-50">
                <DollarSign className="w-4 h-4 mr-2" />
                Payment Follow-ups
              </Button>
            </Link>
            <Link href="/dashboard/orders">
              <Button variant="outline" className="border-gray-300 hover:bg-gray-50">
                <Eye className="w-4 h-4 mr-2" />
                View All Orders
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest orders in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No orders yet. <Link href="/dashboard/orders/new" className="text-primary hover:underline">Create your first order</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

