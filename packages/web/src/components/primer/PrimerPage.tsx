import { Box } from "@primer/react"

import type { ReactNode } from "react"

export const primerPageMaxWidth = "768px"

export const PrimerPanel = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      bg: "canvas.default",
      border: "1px solid",
      borderColor: "border.default",
      borderRadius: 2,
      overflow: "hidden",
    }}
  >
    {children}
  </Box>
)

export const PrimerPanelBody = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: "grid", gap: 3, p: 3 }}>{children}</Box>
)
