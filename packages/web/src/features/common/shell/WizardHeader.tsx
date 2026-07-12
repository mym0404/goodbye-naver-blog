import {
  BookIcon,
  GlobeIcon,
  MarkGithubIcon,
  MoonIcon,
  SunIcon,
  ThreeBarsIcon,
} from "@primer/octicons-react"
import {
  ActionList,
  ActionMenu,
  Box,
  IconButton,
  Label,
  LabelGroup,
  Link,
  PageHeader,
  SegmentedControl,
} from "@primer/react"

import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"

import { PrimerStatusLabel } from "../../../components/primer/PrimerStatusLabel.js"
import { createAppHref } from "../../../lib/AppRoutes.js"
import { getStatusPillLabel } from "../status/StatusPill.js"

const headerLinks = [
  {
    pathname: "/storybook",
    Icon: BookIcon,
    label: "Storybook",
  },
  {
    href: "https://github.com/mym0404/exitpress",
    Icon: MarkGithubIcon,
    label: "GitHub",
    external: true,
  },
  {
    href: "https://mjstudio.net",
    Icon: GlobeIcon,
    label: "MJ Studio",
    external: true,
  },
]

const themeOptions: ThemePreference[] = ["dark", "light"]

export const WizardHeader = ({
  title,
  themePreference,
  headerStatus,
  summaryCards,
  backLink,
  onThemeChange,
}: {
  title: string
  themePreference: ThemePreference
  headerStatus: string
  summaryCards: Array<{ label: string; value: string }>
  backLink?: {
    href: string
    label: string
  }
  onThemeChange: (value: ThemePreference) => void
}) => (
  <PageHeader sx={{ py: [2, 3] }}>
    <PageHeader.TitleArea variant="large">
      <PageHeader.Title as="h1">{title}</PageHeader.Title>
    </PageHeader.TitleArea>

    <PageHeader.Actions>
      <Box
        sx={{
          display: "flex",
          "@media screen and (min-width: 1280px)": {
            display: "none",
          },
        }}
      >
        <ActionMenu>
          <ActionMenu.Anchor>
            <IconButton
              aria-label="메뉴 열기"
              icon={ThreeBarsIcon}
              size="small"
              title="메뉴 열기"
            />
          </ActionMenu.Anchor>
          <ActionMenu.Overlay align="end">
            <ActionList>
              {backLink ? (
                <ActionList.Item
                  onSelect={() => {
                    window.location.href = backLink.href
                  }}
                >
                  {backLink.label}
                </ActionList.Item>
              ) : null}
              <ActionList.Group>
                <ActionList.GroupHeading>Links</ActionList.GroupHeading>
                {headerLinks.map(({ href, pathname, label }) => (
                  <ActionList.LinkItem
                    key={href ?? pathname}
                    href={
                      pathname
                        ? createAppHref({
                            pathname,
                            basePath: import.meta.env.BASE_URL,
                          })
                        : href
                    }
                  >
                    {label}
                  </ActionList.LinkItem>
                ))}
              </ActionList.Group>
              <ActionList.Group selectionVariant="single">
                <ActionList.GroupHeading>Theme</ActionList.GroupHeading>
                {themeOptions.map((theme) => (
                  <ActionList.Item
                    key={theme}
                    selected={themePreference === theme}
                    onSelect={() => {
                      onThemeChange(theme)
                    }}
                  >
                    {theme === "dark" ? "Dark" : "Light"}
                  </ActionList.Item>
                ))}
              </ActionList.Group>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </Box>
      <Box
        sx={{
          display: "none",
          alignItems: "center",
          gap: 2,
          "@media screen and (min-width: 1280px)": {
            display: "flex",
          },
        }}
      >
        {headerLinks.map(({ href, pathname, Icon, external, label }) => (
          <Link
            key={href ?? pathname}
            href={
              pathname
                ? createAppHref({
                    pathname,
                    basePath: import.meta.env.BASE_URL,
                  })
                : href
            }
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              color: "fg.muted",
              fontSize: 0,
              fontWeight: "semibold",
              whiteSpace: "nowrap",
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <SegmentedControl
          aria-label="테마 선택"
          size="small"
          onChange={(selectedIndex) => {
            const nextTheme = themeOptions[selectedIndex]

            if (nextTheme) {
              onThemeChange(nextTheme)
            }
          }}
        >
          <SegmentedControl.IconButton
            aria-label="다크"
            icon={MoonIcon}
            selected={themePreference === "dark"}
          />
          <SegmentedControl.IconButton
            aria-label="라이트"
            icon={SunIcon}
            selected={themePreference === "light"}
          />
        </SegmentedControl>
      </Box>
    </PageHeader.Actions>

    <PageHeader.Navigation as="div">
      <Box id="summary" aria-live="polite">
        <LabelGroup visibleChildCount="auto">
          {summaryCards.map((card) => (
            <Label key={card.label} variant="secondary">
              {card.label} {card.value}
            </Label>
          ))}
          <Box
            as="span"
            id="status-text"
            data-status={headerStatus}
            sx={{ display: "inline-flex" }}
          >
            <PrimerStatusLabel status={headerStatus}>
              {getStatusPillLabel(headerStatus)}
            </PrimerStatusLabel>
          </Box>
        </LabelGroup>
      </Box>
    </PageHeader.Navigation>
  </PageHeader>
)
