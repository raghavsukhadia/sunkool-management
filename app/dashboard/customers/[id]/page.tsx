import { getCustomerById } from "@/app/actions/customers"
import { CustomerProfile } from "./CustomerProfile"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default async function CustomerProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const res = await getCustomerById(params.id)

  if (!res.success || !res.data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-red-500">
        <AlertCircle className="h-6 w-6" />
        <p>{res.error ?? "Customer not found."}</p>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Back to Customers
        </Link>
      </div>
    )
  }

  return <CustomerProfile customer={res.data} />
}
