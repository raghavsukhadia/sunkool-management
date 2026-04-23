export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-32 rounded-lg bg-slate-200" />
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-6 w-48 rounded bg-slate-200" />
            <div className="h-4 w-32 rounded bg-slate-200" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-2.5 h-7 w-24 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[30%_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
            <div className="space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="h-5 rounded bg-slate-100" />)}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3.5">
            <div className="flex gap-6">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-4 w-16 rounded bg-slate-200" />)}
            </div>
          </div>
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded bg-slate-100" />)}
          </div>
        </div>
      </div>
    </div>
  )
}
