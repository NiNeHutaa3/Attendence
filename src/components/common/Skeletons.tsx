export const SkeletonLoader = ({ className = '' }: { className?: string }) => {
  return <div className={`skeleton rounded-lg bg-slate-200 ${className}`} />
}

export const CardSkeleton = () => {
  return (
    <div className="card-base p-6 space-y-4">
      <SkeletonLoader className="h-6 w-1/3" />
      <SkeletonLoader className="h-4 w-full" />
      <SkeletonLoader className="h-4 w-2/3" />
    </div>
  )
}

export const StatCardSkeleton = () => {
  return (
    <div className="card-base p-6">
      <SkeletonLoader className="h-10 w-1/2 mb-2" />
      <SkeletonLoader className="h-4 w-2/3" />
    </div>
  )
}
