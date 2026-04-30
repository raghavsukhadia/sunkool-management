import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { getAllItems, getItemsList, type ItemsListQuery } from "@/app/actions/items"
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

  const [response, allItemsResponse] = await Promise.all([getItemsList(query), getAllItems()])
  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/8aee2203-9b99-4ec2-b9d6-3286a96aa65d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ae1a3c" },
    body: JSON.stringify({
      sessionId: "ae1a3c",
      runId: "initial",
      hypothesisId: "H5",
      location: "app/dashboard/items/page.tsx:ItemsPage",
      message: "Items page server payload sizes",
      data: {
        listRows: response.data?.rows.length ?? 0,
        listTotalRows: response.data?.total_rows ?? 0,
        allItemsCount: allItemsResponse.data?.length ?? 0,
        listSuccess: response.success,
        allItemsSuccess: allItemsResponse.success,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  if (!response.success || !response.data || !allItemsResponse.success || !allItemsResponse.data) {
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

  return <ItemsPageClient initialQuery={query} initialData={response.data} allItems={allItemsResponse.data} />
}
