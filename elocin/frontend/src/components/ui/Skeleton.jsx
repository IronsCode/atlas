import { Card } from './Card.jsx'

// Shimmer placeholders that replace the bare "Loading…" text app-wide.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-surface2 ${className}`} />
}

// A card of stacked avatar+text rows — matches the roster/list layout so the
// page doesn't visually jump when data arrives.
export function ListSkeleton({ rows = 5 }) {
  return (
    <Card className="p-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-3 ${i !== rows - 1 ? 'border-b border-border' : ''}`}
        >
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </Card>
  )
}

// A row of KPI-card placeholders.
export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  )
}
