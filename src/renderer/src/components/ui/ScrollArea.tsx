import { forwardRef, memo, type CSSProperties, type HTMLAttributes } from "react"

type ScrollAreaProps = Omit<HTMLAttributes<HTMLDivElement>, "className" | "style"> & {
  rootClassName?: string
  viewportClassName?: string
  viewportStyle?: CSSProperties
  stableGutter?: boolean
}

export const ScrollArea = memo(forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea({
  rootClassName,
  viewportClassName,
  viewportStyle,
  stableGutter = true,
  children,
  onScroll,
  ...rest
}, ref) {
  return (
    <div className={rootClassName}>
      <div
        {...rest}
        ref={ref}
        className={viewportClassName}
        style={{
          ...(stableGutter ? { scrollbarGutter: "stable both-edges" as const } : null),
          ...viewportStyle,
        }}
        onScroll={onScroll}
      >
        {children}
      </div>
    </div>
  )
}))
