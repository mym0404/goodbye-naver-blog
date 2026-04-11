import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

export const Toaster = (props: ToasterProps) => (
  <Sonner
    closeButton
    expand
    position="top-right"
    richColors
    toastOptions={{
      classNames: {
        toast:
          "rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_40px_rgba(22,33,50,0.12)]",
        title: "text-sm font-semibold",
        description: "text-sm text-slate-600",
        actionButton: "rounded-xl",
        cancelButton: "rounded-xl",
      },
    }}
    {...props}
  />
)

export { toast }
