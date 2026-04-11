import * as React from "react"

import { cn } from "../../lib/cn.js"

type ToggleGroupContextValue = {
  value: string | null
  onValueChange?: (value: string) => void
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  value: null,
})

export const ToggleGroup = ({
  className,
  value,
  onValueChange,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  type?: "single"
  value?: string
  onValueChange?: (value: string) => void
}) => (
  <div className={cn("flex items-center justify-center gap-1", className)} {...props}>
    <ToggleGroupContext.Provider value={{ value: value ?? null, onValueChange }}>
      {children}
    </ToggleGroupContext.Provider>
  </div>
)

export const ToggleGroupItem = ({
  className,
  value,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
}) => {
  const context = React.useContext(ToggleGroupContext)
  const isActive = context.value === value

  return (
    <button
      type="button"
      className={cn(className)}
      data-state={isActive ? "on" : "off"}
      onClick={() => context.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  )
}
