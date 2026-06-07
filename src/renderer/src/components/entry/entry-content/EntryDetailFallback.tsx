export function EntryDetailFallback({ title }: { title: string }) {
  return (
    <div className="animate-in fade-in-0 space-y-5 duration-200">
      <div className="border-border/60 bg-surface-secondary/70 text-text-secondary dark:bg-surface-dark-secondary/70 dark:text-text-dark-secondary rounded-xl border px-4 py-3 text-sm">
        正在准备完整内容…
      </div>
      <div className="animate-pulse space-y-3">
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-4 w-40 rounded" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-full rounded" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-[92%] rounded" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-[84%] rounded" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-40 w-full rounded-2xl" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-full rounded" />
        <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary h-3.5 w-[88%] rounded" />
      </div>
      <p className="dark:text-text-dark-tertiary text-text-tertiary text-xs">
        {title}
      </p>
    </div>
  )
}
