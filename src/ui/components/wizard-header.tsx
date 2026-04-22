import { RiMoonClearLine, RiSunLine } from "@remixicon/react"

import { Badge } from "./ui/badge.js"
import { Card, CardContent } from "./ui/card.js"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group.js"
import type { ThemePreference } from "../../shared/types.js"
import { getStatusPillClassName } from "../lib/status-pill.js"

export const WizardHeader = ({
  isSetupStep,
  setupStepIndex,
  setupStepCount,
  title,
  description,
  themePreference,
  headerStatus,
  summaryCards,
  onThemeChange,
}: {
  isSetupStep: boolean
  setupStepIndex: number
  setupStepCount: number
  title: string
  description: string
  themePreference: ThemePreference
  headerStatus: string
  summaryCards: Array<{ label: string; value: string }>
  onThemeChange: (value: ThemePreference) => void
}) => (
  <Card variant="panel" className="overflow-hidden">
    <CardContent className="grid gap-4 p-5">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="wizard-heading grid gap-1.5">
          <span className="wizard-step-label wizard-kicker">
            {isSetupStep ? `단계 ${setupStepIndex + 1} / ${setupStepCount}` : "현재 단계"}
          </span>
          <div className="grid gap-1.5">
            <h1 className="wizard-title text-[clamp(1.7rem,2.5vw,2.4rem)] leading-[1.04]">{title}</h1>
            {description ? <p className="panel-description max-w-3xl text-sm leading-6">{description}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
          <ToggleGroup
            className="theme-toggle rounded-full p-1"
            aria-label="테마 선택"
            value={themePreference}
            onValueChange={(value) => {
              if (value === "dark" || value === "light") {
                onThemeChange(value)
              }
            }}
          >
            <ToggleGroupItem aria-label="다크" className="theme-toggle-item size-8 p-0" title="다크" value="dark">
              <RiMoonClearLine data-theme-icon aria-hidden="true" />
              <span className="sr-only">다크</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              aria-label="라이트"
              className="theme-toggle-item size-8 p-0"
              title="라이트"
              value="light"
            >
              <RiSunLine data-theme-icon aria-hidden="true" />
              <span className="sr-only">라이트</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Badge id="status-text" className={getStatusPillClassName(headerStatus)} data-status={headerStatus}>
            {headerStatus}
          </Badge>
        </div>
      </div>

      <div
        id="summary"
        className="wizard-summary-stats flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {summaryCards.map((card) => (
          <span
            key={card.label}
            className="wizard-summary-metric inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
          >
            <span className="shrink-0 text-muted-foreground">{card.label}</span>
            <strong className="metric-value min-w-0 break-all font-semibold">{card.value}</strong>
          </span>
        ))}
      </div>
    </CardContent>
  </Card>
)
