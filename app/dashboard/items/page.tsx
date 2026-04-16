import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { getItemsList, type ItemsListQuery } from "@/app/actions/items"
import { Button } from "@/components/ui/button"
import { ItemsPageClient } from "@/components/dashboard/items/ItemsPageClient"

type SearchParams = Record<string, string | string[] | undefined>

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const query: ItemsListQuery = {
    page: Number(readParam(searchParams?.page)) || 1,
    page_size: Number(readParam(searchParams?.page_size)) || 25,
    search: readParam(searchParams?.search),
    customer_id: readParam(searchParams?.customer_id),
    category: readParam(searchParams?.category),
    dispatch_status: (readParam(searchParams?.dispatch_status) || "all") as ItemsListQuery["dispatch_status"],
    sort_key: (readParam(searchParams?.sort_key) || "last_ordered_at") as ItemsListQuery["sort_key"],
    sort_dir: (readParam(searchParams?.sort_dir) || "desc") as ItemsListQuery["sort_dir"],
  }

  const response = await getItemsList(query)
  if (!response.success || !response.data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-sk-border bg-white py-24 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-sm font-medium text-sk-text-1">Unable to load items</p>
        <p className="mt-1 text-xs text-sk-text-3">{response.error ?? "Unexpected error"}</p>
        <Link href="/dashboard/items" className="mt-4">
          <Button className="bg-sk-primary text-white hover:bg-sk-primary-dk">Retry</Button>
        </Link>
      </div>
    )
  }

  return <ItemsPageClient initialQuery={query} initialData={response.data} />
}
