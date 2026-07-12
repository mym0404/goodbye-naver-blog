import { Box, FormControl, Label, NavList, Text } from "@primer/react"
import { useEffect, useMemo, useState } from "react"

import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { ReactNode } from "react"

import type { StorybookStory } from "./schema/Storybook.js"

import { PrimerAppProvider } from "../../app/PrimerAppProvider.js"
import { primerPageMaxWidth } from "../../components/primer/PrimerPage.js"
import { PrimerSelectActionMenu } from "../../components/primer/PrimerSelectActionMenu.js"
import { createAppHref, shouldShowStorybookBackLink } from "../../lib/AppRoutes.js"
import { useThemePreference } from "../common/hooks/UseThemePreference.js"
import { WizardHeader } from "../common/shell/WizardHeader.js"
import { BlockTemplateCard, getEffectiveBlockTemplate } from "../options/BlockTemplateCard.js"

import { storybookCatalog } from "./StorybookCatalog.js"

const getInitialStoryKey = () => {
  const hashKey = window.location.hash.replace(/^#/, "")
  const firstStory = storybookCatalog[0]?.stories[0]

  return storybookCatalog.some((group) => group.stories.some((story) => story.storyKey === hashKey))
    ? hashKey
    : (firstStory?.storyKey ?? "")
}

const getStoryCount = () =>
  storybookCatalog.reduce((count, group) => count + group.stories.length, 0)

const findStory = (storyKey: string) =>
  storybookCatalog.flatMap((group) => group.stories).find((story) => story.storyKey === storyKey)

const formatHtmlForDisplay = (html: string) => {
  const lines: string[] = []
  let depth = 0

  html
    .replace(/>\s+</g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const isClosingTag = line.startsWith("</")
      const isSelfClosingTag = line.endsWith("/>") || /^<(br|hr|img|input|meta|link)\b/i.test(line)

      if (isClosingTag) {
        depth = Math.max(0, depth - 1)
      }

      lines.push(`${"  ".repeat(depth)}${line}`)

      if (!isClosingTag && !isSelfClosingTag && /^<[^!?/][^>]*>$/.test(line)) {
        depth += 1
      }
    })

  return lines.join("\n")
}

const htmlTokenSx = {
  bracket: { color: "fg.muted" },
  tag: { color: "success.fg" },
  attribute: { color: "accent.fg" },
  operator: { color: "fg.muted" },
  value: { color: "done.fg" },
  comment: { color: "fg.muted" },
  text: { color: "fg.default" },
} as const

const markdownTokenSx = {
  marker: { color: "accent.fg" },
  fence: { color: "success.fg" },
  link: { color: "done.fg" },
  code: { color: "success.fg" },
  text: { color: "fg.default" },
} as const

const renderToken = (
  key: string,
  tokenType: keyof typeof htmlTokenSx | keyof typeof markdownTokenSx,
  children: string,
) => {
  const sx =
    tokenType in htmlTokenSx
      ? htmlTokenSx[tokenType as keyof typeof htmlTokenSx]
      : markdownTokenSx[tokenType as keyof typeof markdownTokenSx]

  return (
    <Box key={key} as="span" data-storybook-token={tokenType} sx={sx}>
      {children}
    </Box>
  )
}

const renderHtmlTag = (tag: string, tokenKey: string): ReactNode[] => {
  const tagNameMatch = tag.match(/^<\/?\s*([A-Za-z][\w:.-]*)/)

  if (!tagNameMatch) {
    return [renderToken(`${tokenKey}-tag`, "text", tag)]
  }

  const tagName = tagNameMatch[1]
  const tagNameStart = tag.indexOf(tagName)
  const tagNameEnd = tagNameStart + tagName.length
  const nodes: ReactNode[] = [
    renderToken(`${tokenKey}-open`, "bracket", tag.slice(0, tagNameStart)),
    renderToken(`${tokenKey}-name`, "tag", tagName),
  ]
  const attributeSource = tag.slice(tagNameEnd, -1)
  const attributePattern = /([^\s=<>"'`]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g
  let cursor = 0
  let attributeMatch: RegExpExecArray | null

  while ((attributeMatch = attributePattern.exec(attributeSource)) !== null) {
    const [source, name, operator, value] = attributeMatch

    if (attributeMatch.index > cursor) {
      nodes.push(
        renderToken(
          `${tokenKey}-between-${cursor}`,
          "bracket",
          attributeSource.slice(cursor, attributeMatch.index),
        ),
      )
    }

    nodes.push(renderToken(`${tokenKey}-attr-${attributeMatch.index}`, "attribute", name))
    nodes.push(renderToken(`${tokenKey}-operator-${attributeMatch.index}`, "operator", operator))
    nodes.push(renderToken(`${tokenKey}-value-${attributeMatch.index}`, "value", value))
    cursor = attributeMatch.index + source.length
  }

  if (cursor < attributeSource.length) {
    nodes.push(renderToken(`${tokenKey}-tail`, "bracket", attributeSource.slice(cursor)))
  }

  nodes.push(renderToken(`${tokenKey}-close`, "bracket", tag.slice(-1)))

  return nodes
}

const highlightHtml = (html: string): ReactNode[] =>
  html.split(/(<[^>]+>)/g).reduce<ReactNode[]>((nodes, part, index) => {
    if (!part) {
      return nodes
    }

    if (part.startsWith("<!--")) {
      nodes.push(renderToken(`html-comment-${index}`, "comment", part))
      return nodes
    }

    if (part.startsWith("<")) {
      nodes.push(...renderHtmlTag(part, `html-tag-${index}`))
      return nodes
    }

    nodes.push(renderToken(`html-text-${index}`, "text", part))
    return nodes
  }, [])

const highlightMarkdownLine = (line: string, lineIndex: number): ReactNode[] => {
  if (/^\s*```/.test(line)) {
    return [renderToken(`md-${lineIndex}-fence`, "fence", line)]
  }

  const nodes: ReactNode[] = []
  const markerMatch = line.match(/^(\s*(?:#{1,6}|>|[-*+]|\d+[.)])\s+)/)
  let cursor = 0

  if (markerMatch) {
    nodes.push(renderToken(`md-${lineIndex}-marker`, "marker", markerMatch[1]))
    cursor = markerMatch[1].length
  }

  const inlinePattern = /(!?\[[^\]]+\]\([^)]+\)|`[^`]+`)/g
  inlinePattern.lastIndex = cursor
  let inlineMatch: RegExpExecArray | null

  while ((inlineMatch = inlinePattern.exec(line)) !== null) {
    if (inlineMatch.index > cursor) {
      nodes.push(
        renderToken(
          `md-${lineIndex}-text-${cursor}`,
          "text",
          line.slice(cursor, inlineMatch.index),
        ),
      )
    }

    nodes.push(
      renderToken(
        `md-${lineIndex}-inline-${inlineMatch.index}`,
        inlineMatch[0].startsWith("`") ? "code" : "link",
        inlineMatch[0],
      ),
    )
    cursor = inlineMatch.index + inlineMatch[0].length
  }

  if (cursor < line.length) {
    nodes.push(renderToken(`md-${lineIndex}-text-tail`, "text", line.slice(cursor)))
  }

  return nodes.length > 0 ? nodes : [renderToken(`md-${lineIndex}-empty`, "text", line)]
}

const highlightMarkdown = (markdown: string): ReactNode[] =>
  markdown.split("\n").reduce<ReactNode[]>((nodes, line, index, lines) => {
    nodes.push(...highlightMarkdownLine(line, index))

    if (index < lines.length - 1) {
      nodes.push("\n")
    }

    return nodes
  }, [])

const panelSx = {
  border: "1px solid",
  borderColor: "border.default",
  borderRadius: 2,
  bg: "canvas.default",
  overflow: "hidden",
} as const

const codeBlockSx = ({
  codeType,
  compact,
}: {
  codeType: StorybookCodeType
  compact?: boolean
}) => ({
  m: 0,
  minWidth: 0,
  maxHeight: "520px",
  overflowX: "auto",
  overflowY: "auto",
  overscrollBehaviorX: "contain",
  p: 3,
  color: "fg.default",
  fontFamily: "mono",
  fontSize: compact ? "11px" : "12px",
  lineHeight: "20px",
  whiteSpace: codeType === "html" ? "pre" : "pre-wrap",
})

const StoryTree = ({
  activeStoryKey,
  onSelect,
}: {
  activeStoryKey: string
  onSelect: (storyKey: string) => void
}) => (
  <Box
    as="aside"
    data-storybook-tree
    sx={{
      display: "grid",
      height: "100%",
      minHeight: 0,
      gridTemplateRows: "auto minmax(0, 1fr)",
    }}
  >
    <Box sx={{ borderBottom: "1px solid", borderColor: "border.default", px: 3, py: 3 }}>
      <Text sx={{ color: "fg.default", fontSize: 2, fontWeight: 600 }}>블록 목록</Text>
      <Text sx={{ color: "fg.muted", display: "block", fontSize: 0, mt: 1 }}>
        {getStoryCount()} blocks
      </Text>
    </Box>
    <Box sx={{ minHeight: 0, overflowY: "auto", px: 2, py: 3 }}>
      <NavList aria-label="Storybook 블록 목록">
        {storybookCatalog.map((group) => (
          <NavList.Group
            key={group.editorType}
            title={`${group.editorLabel} (${group.stories.length})`}
          >
            {group.stories.map((story) => {
              const active = story.storyKey === activeStoryKey

              return (
                <NavList.Item
                  key={story.storyKey}
                  href={`#${story.storyKey}`}
                  aria-current={active ? "page" : undefined}
                  data-storybook-block={story.storyKey}
                  onClick={(event) => {
                    event.preventDefault()
                    onSelect(story.storyKey)
                  }}
                >
                  <Text
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "2ch minmax(0, 1fr)",
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <Box as="span" sx={{ color: "fg.muted", fontSize: 0 }}>
                      {story.blockIndex + 1}
                    </Box>
                    <Box
                      as="span"
                      sx={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {story.blockLabel}
                    </Box>
                  </Text>
                </NavList.Item>
              )
            })}
          </NavList.Group>
        ))}
      </NavList>
    </Box>
  </Box>
)

const allStorybookCodeTypes = ["html", "markdown"] as const
type StorybookCodeType = (typeof allStorybookCodeTypes)[number]

const CodePanel = ({
  title,
  children,
  codeType,
  compact = false,
}: {
  title: string
  children: string
  codeType: StorybookCodeType
  compact?: boolean
}) => (
  <Box sx={panelSx}>
    <Box sx={{ borderBottom: "1px solid", borderColor: "border.default", p: 3 }}>
      <Text sx={{ color: "fg.default", fontSize: 2, fontWeight: 600 }}>{title}</Text>
    </Box>
    <Box
      as="pre"
      aria-label={`${title} 코드`}
      data-storybook-code={codeType}
      tabIndex={0}
      sx={codeBlockSx({
        codeType,
        compact,
      })}
    >
      {codeType === "html" ? highlightHtml(children) : highlightMarkdown(children)}
    </Box>
  </Box>
)

const StoryTemplateCard = ({
  story,
  themePreference,
}: {
  story: StorybookStory
  themePreference: ThemePreference
}) => {
  const [template, setTemplate] = useState("")

  useEffect(() => {
    setTemplate("")
  }, [story.storyKey])

  return (
    <BlockTemplateCard
      key={story.storyKey}
      definition={story.templateDefinition}
      template={getEffectiveBlockTemplate({
        definition: story.templateDefinition,
        template,
      })}
      themePreference={themePreference}
      readOnly
      onTemplateChange={setTemplate}
    />
  )
}

const StoryPreview = ({
  story,
  themePreference,
}: {
  story: StorybookStory
  themePreference: ThemePreference
}) => {
  return (
    <Box as="section" data-active-storybook-story={story.storyKey} sx={{ display: "grid", gap: 3 }}>
      <Box
        aria-label="선택된 Storybook 항목"
        data-storybook-summary="true"
        sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}
      >
        <Label variant="secondary" size="large">
          {story.blockLabel}
        </Label>
        <Label size="large">
          {story.editorLabel} / {story.blockId}
        </Label>
      </Box>

      <StoryTemplateCard story={story} themePreference={themePreference} />

      <Box
        sx={{
          display: "grid",
          gap: 3,
          "@media (min-width: 1280px)": {
            gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
          },
        }}
      >
        <CodePanel title="입력 HTML" codeType="html" compact>
          {formatHtmlForDisplay(story.inputHtml)}
        </CodePanel>
        <Box sx={panelSx}>
          <Box sx={{ borderBottom: "1px solid", borderColor: "border.default", p: 3 }}>
            <Text sx={{ color: "fg.default", fontSize: 2, fontWeight: 600 }}>원본 캡처</Text>
          </Box>
          <Box sx={{ display: "grid", placeItems: "center", bg: "canvas.subtle", p: 3 }}>
            <Box
              as="img"
              src={story.screenshotSrc}
              alt={`${story.blockLabel} 원본 캡처`}
              sx={{
                maxHeight: "420px",
                maxWidth: "100%",
                border: "1px solid",
                borderColor: "border.default",
                borderRadius: 2,
                bg: "canvas.default",
                objectFit: "contain",
              }}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={panelSx}>
        <Box sx={{ borderBottom: "1px solid", borderColor: "border.default", p: 3 }}>
          <Text sx={{ color: "fg.default", fontSize: 2, fontWeight: 600 }}>Markdown</Text>
        </Box>
        <Box
          as="pre"
          aria-label="Markdown 코드"
          data-storybook-markdown
          tabIndex={0}
          sx={codeBlockSx({ codeType: "markdown" })}
        >
          {highlightMarkdown(story.markdown)}
        </Box>
      </Box>
    </Box>
  )
}

export const StorybookPage = () => {
  const [themePreference, setThemePreference] = useState<ThemePreference>("dark")
  const [activeStoryKey, setActiveStoryKey] = useState(getInitialStoryKey)
  const activeStory = useMemo(() => findStory(activeStoryKey), [activeStoryKey])
  useThemePreference(themePreference)
  const backLink = shouldShowStorybookBackLink(import.meta.env.BASE_URL)
    ? {
        href: createAppHref({
          pathname: "/",
          basePath: import.meta.env.BASE_URL,
        }),
        label: "뒤로",
      }
    : undefined
  const summaryCards = useMemo(
    () => [
      { label: "편집기", value: String(storybookCatalog.length) },
      { label: "블록", value: String(getStoryCount()) },
    ],
    [],
  )

  useEffect(() => {
    const handleHashChange = () => {
      setActiveStoryKey(getInitialStoryKey())
    }

    window.addEventListener("hashchange", handleHashChange)

    return () => {
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [])

  const selectStory = (storyKey: string) => {
    setActiveStoryKey(storyKey)
    window.history.replaceState(null, "", `#${storyKey}`)
  }

  if (!activeStory) {
    return null
  }

  return (
    <PrimerAppProvider themePreference={themePreference}>
      <Box
        as="main"
        sx={{
          minHeight: "100vh",
          width: "100%",
          overflowX: "clip",
          bg: "canvas.default",
        }}
      >
        <Box
          sx={{
            bg: "canvas.subtle",
            borderBottom: "1px solid",
            borderColor: "border.default",
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: primerPageMaxWidth,
              mx: "auto",
              px: [3, 4],
            }}
          >
            <WizardHeader
              title="Storybook"
              themePreference={themePreference}
              headerStatus="ready"
              summaryCards={summaryCards}
              backLink={backLink}
              onThemeChange={setThemePreference}
            />
          </Box>
        </Box>
        <Box
          data-storybook-layout
          sx={{
            display: ["block", null, "grid"],
            gridTemplateColumns: [undefined, null, "20rem minmax(0, 1fr)"],
            minHeight: ["auto", null, "calc(100vh - 9rem)"],
          }}
        >
          <Box
            data-storybook-pane
            sx={{
              display: ["none", null, "block"],
              minHeight: "calc(100vh - 9rem)",
              maxHeight: "calc(100vh - 9rem)",
              overflow: "hidden",
              bg: "canvas.subtle",
              borderRight: "1px solid",
              borderColor: "border.default",
              position: "sticky",
              top: 0,
            }}
          >
            <StoryTree activeStoryKey={activeStory.storyKey} onSelect={selectStory} />
          </Box>
          <Box
            sx={{
              minWidth: 0,
              px: [3, 4],
              py: [3, 4],
            }}
          >
            <Box
              sx={{
                display: "grid",
                gap: 3,
                maxWidth: primerPageMaxWidth,
                mx: "auto",
              }}
            >
              <Box sx={{ display: ["block", null, "none"] }}>
                <FormControl id="storybook-block-select">
                  <FormControl.Label>블록 선택</FormControl.Label>
                  <PrimerSelectActionMenu
                    id="storybook-block-select"
                    value={activeStory.storyKey}
                    groups={storybookCatalog.map((group) => ({
                      label: group.editorLabel,
                      options: group.stories.map((story) => ({
                        value: story.storyKey,
                        label: `${story.blockIndex + 1}. ${story.blockLabel}`,
                      })),
                    }))}
                    onValueChange={selectStory}
                  />
                </FormControl>
              </Box>
              <StoryPreview story={activeStory} themePreference={themePreference} />
            </Box>
          </Box>
        </Box>
      </Box>
    </PrimerAppProvider>
  )
}
