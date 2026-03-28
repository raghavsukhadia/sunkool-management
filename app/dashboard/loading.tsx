import { Skeleton } from "@/components/ui/skeleton"

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-sk-border bg-white p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-10 w-20" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>

      <div className="rounded-xl border border-sk-border bg-white p-5">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="mt-2 h-4 w-72" />
        <Skeleton className="mt-6 h-44 w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[65%_35%]">
        <div className="rounded-xl border border-sk-border bg-white p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
        <div className="rounded-xl border border-sk-border bg-white p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
      </div>
    </div>
  )
}
