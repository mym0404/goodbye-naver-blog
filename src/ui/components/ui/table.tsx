import * as React from "react"

import { cn } from "../../lib/cn.js"

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn("w-full border-collapse text-left text-sm", className)}
      {...props}
    />
  ),
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        "bg-[color-mix(in_srgb,var(--panel-muted)_98%,var(--card))] supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--panel-muted)_92%,transparent)] backdrop-blur",
        className,
      )}
      {...props}
    />
  ),
)
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />,
)
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_72%,transparent)]",
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "bg-[color-mix(in_srgb,var(--panel-muted)_98%,var(--card))] supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--panel-muted)_92%,transparent)] bg-clip-padding px-3 py-2.5 align-middle font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-[inset_0_-1px_0_0_var(--border)] first:rounded-tl-[calc(var(--radius-lg)-4px)] last:rounded-tr-[calc(var(--radius-lg)-4px)]",
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-3 py-2.5 align-middle text-foreground", className)} {...props} />
  ),
)
TableCell.displayName = "TableCell"

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
