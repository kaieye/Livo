/**
 * App loading skeleton displayed before data hydration completes.
 * Matches the main layout structure to minimize perceived layout shift.
 */
export function AppSkeleton() {
  return (
    <div className="bg-background relative h-full w-full overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="border-border bg-sidebar fixed inset-y-0 left-0 z-10 w-60 border-r">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-border flex h-14 items-center justify-between border-b px-4">
            <div className="bg-muted h-5 w-20 animate-pulse rounded" />
            <div className="bg-muted h-8 w-8 animate-pulse rounded" />
          </div>

          {/* View tabs */}
          <div className="border-border flex gap-2 border-b px-4 py-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-muted h-8 w-16 animate-pulse rounded"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>

          {/* Feed list */}
          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
              >
                <div className="bg-muted h-9 w-9 shrink-0 animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div
                    className="bg-muted h-3 animate-pulse rounded"
                    style={{
                      width: `${60 + Math.random() * 30}%`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                  <div
                    className="bg-muted/60 h-2 animate-pulse rounded"
                    style={{
                      width: `${40 + Math.random() * 20}%`,
                      animationDelay: `${i * 80 + 50}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="ml-60 flex h-full">
        {/* Entry list skeleton */}
        <div className="border-border bg-background w-96 border-r">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-border flex h-14 items-center justify-between border-b px-4">
              <div className="bg-muted h-6 w-32 animate-pulse rounded" />
              <div className="bg-muted h-8 w-8 animate-pulse rounded" />
            </div>

            {/* Entry list */}
            <div className="flex-1 space-y-px overflow-y-auto">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border-border border-b px-4 py-4">
                  <div className="space-y-2">
                    <div
                      className="bg-muted h-4 animate-pulse rounded"
                      style={{
                        width: `${70 + Math.random() * 25}%`,
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                    <div
                      className="bg-muted/60 h-3 animate-pulse rounded"
                      style={{
                        width: `${85 + Math.random() * 10}%`,
                        animationDelay: `${i * 100 + 50}ms`,
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="bg-muted/50 h-2 w-16 animate-pulse rounded"
                        style={{ animationDelay: `${i * 100 + 100}ms` }}
                      />
                      <div
                        className="bg-muted/50 h-2 w-20 animate-pulse rounded"
                        style={{ animationDelay: `${i * 100 + 150}ms` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content area skeleton */}
        <div className="bg-background flex-1 overflow-y-auto px-12 py-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Title */}
            <div className="space-y-3">
              <div className="bg-muted h-8 w-3/4 animate-pulse rounded" />
              <div className="flex items-center gap-3">
                <div className="bg-muted/60 h-3 w-24 animate-pulse rounded" />
                <div className="bg-muted/60 h-3 w-32 animate-pulse rounded" />
              </div>
            </div>

            {/* Content paragraphs */}
            <div className="space-y-4 pt-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <div
                    className="bg-muted/50 h-3 animate-pulse rounded"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                  <div
                    className="bg-muted/50 h-3 animate-pulse rounded"
                    style={{ animationDelay: `${i * 150 + 50}ms` }}
                  />
                  <div
                    className="bg-muted/50 h-3 w-5/6 animate-pulse rounded"
                    style={{ animationDelay: `${i * 150 + 100}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
