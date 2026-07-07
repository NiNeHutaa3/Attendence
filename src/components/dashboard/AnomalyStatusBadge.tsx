type AnomalyStatusBadgeProps = {
  isAnomaly?: boolean | null
}

export const AnomalyStatusBadge = ({ isAnomaly }: AnomalyStatusBadgeProps) => {
  if (isAnomaly) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
        Perlu cek
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
      Normal
    </span>
  )
}
