import { autocompletion } from "@codemirror/autocomplete"
import { javascript } from "@codemirror/lang-javascript"
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorView } from "@codemirror/view"
import { ActionList, ActionMenu, Box, Button, Dialog, Label, Text } from "@primer/react"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"
import CodeMirror from "@uiw/react-codemirror"
import { useMemo, useState } from "react"

import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type {
  BlockTemplatePreset,
  TemplatePropDefinition,
} from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"
import type { ComponentPropsWithoutRef } from "react"

import { createTemplatePropCompletionSource } from "./TemplatePropAutocomplete.js"
import { flattenTemplatePropDefinitions } from "./TemplatePropDefinitions.js"

const allTemplateEditorSurfaces = ["card", "embedded"] as const
type TemplateEditorSurface = (typeof allTemplateEditorSurfaces)[number]
let lastTemplateEditorScroll: { x: number; y: number } | undefined
const restoreTemplateEditorScroll = () => {
  const scroll = lastTemplateEditorScroll

  if (!scroll) {
    return
  }

  if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) {
    window.scrollTo(scroll.x, scroll.y)
  }
}
const createTemplateEditorBaseExtensions = (themePreference: ThemePreference) => [
  themePreference === "light" ? githubLight : githubDark,
  EditorView.lineWrapping,
  javascript({ typescript: true }),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.theme(
    {
      ".cm-tooltip.cm-tooltip-autocomplete": {
        overflow: "hidden",
        padding: "0.25rem",
        border: "1px solid var(--borderColor-default)",
        borderRadius: "0.375rem",
        backgroundColor: "var(--overlay-bgColor, var(--bgColor-default))",
        boxShadow: "var(--shadow-floating-small, 0 8px 24px rgba(140, 149, 159, 0.2))",
        color: "var(--fgColor-default)",
        fontFamily: "var(--fontStack-monospace)",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        maxHeight: "14rem",
        minWidth: "13.5rem",
        padding: "0",
        scrollbarWidth: "thin",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        display: "flex",
        alignItems: "baseline",
        gap: "0.625rem",
        minHeight: "2rem",
        padding: "0.375rem 0.625rem",
        borderRadius: "0.375rem",
        color: "var(--fgColor-default)",
        lineHeight: "1.35",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "var(--control-transparent-bgColor-hover, var(--bgColor-accent-muted))",
        color: "var(--fgColor-default)",
      },
      ".cm-tooltip.cm-tooltip-autocomplete .cm-completionIcon": {
        display: "none",
      },
      ".cm-tooltip.cm-tooltip-autocomplete .cm-completionLabel": {
        color: "inherit",
        fontSize: "0.8125rem",
        fontWeight: "650",
      },
      ".cm-tooltip.cm-tooltip-autocomplete .cm-completionMatchedText": {
        color: "var(--fgColor-accent)",
        fontWeight: "800",
        textDecoration: "none",
      },
      ".cm-tooltip.cm-tooltip-autocomplete .cm-completionDetail": {
        marginLeft: "auto",
        color: "var(--fgColor-muted)",
        fontFamily: "var(--fontStack-sansSerif)",
        fontSize: "0.75rem",
        fontStyle: "normal",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail": {
        color: "var(--fgColor-muted)",
      },
    },
    { dark: themePreference !== "light" },
  ),
  EditorView.domEventHandlers({
    click: (event, view) => {
      const target = event.target

      if (!(target instanceof Element) || !view.dom.contains(target)) {
        return false
      }

      lastTemplateEditorScroll ??= {
        x: window.scrollX,
        y: window.scrollY,
      }
      view.contentDOM.focus({ preventScroll: true })

      requestAnimationFrame(() => {
        view.contentDOM.focus({ preventScroll: true })
        restoreTemplateEditorScroll()
      })
      window.setTimeout(restoreTemplateEditorScroll, 0)
      window.setTimeout(restoreTemplateEditorScroll, 100)
      window.setTimeout(() => {
        restoreTemplateEditorScroll()
        lastTemplateEditorScroll = undefined
      }, 200)

      return false
    },
    mousedown: (event, view) => {
      const target = event.target

      if (!(target instanceof Element) || !view.dom.contains(target)) {
        return false
      }

      lastTemplateEditorScroll = {
        x: window.scrollX,
        y: window.scrollY,
      }
      view.contentDOM.focus({ preventScroll: true })
      requestAnimationFrame(() => {
        restoreTemplateEditorScroll()
      })
      window.setTimeout(restoreTemplateEditorScroll, 0)
      window.setTimeout(restoreTemplateEditorScroll, 100)
      window.setTimeout(() => {
        restoreTemplateEditorScroll()
        lastTemplateEditorScroll = undefined
      }, 200)

      return false
    },
  }),
]

const codeSurfaceSx = {
  bg: "canvas.inset",
  border: "1px solid",
  borderColor: "border.default",
  borderRadius: 2,
  color: "fg.default",
  display: "block",
  fontFamily: "mono",
  fontSize: 1,
  lineHeight: "20px",
  overflowWrap: "anywhere",
  px: 3,
  py: 2,
} as const

export const TemplateEditorCard = ({
  title,
  badge,
  editorId,
  presetButtonId,
  presets = [],
  props,
  value,
  themePreference,
  readOnly = false,
  minHeight = "9rem",
  surface = "card",
  onPresetApply,
  onTemplateChange,
  ...sectionProps
}: ComponentPropsWithoutRef<"section"> & {
  title: string
  badge?: string
  editorId: string
  presetButtonId?: string
  presets?: BlockTemplatePreset[]
  props: Record<string, TemplatePropDefinition>
  value: string
  themePreference: ThemePreference
  readOnly?: boolean
  minHeight?: string
  surface?: TemplateEditorSurface
  onPresetApply?: (template: string) => void
  onTemplateChange?: (template: string) => void
}) => {
  const [syntaxDialogOpen, setSyntaxDialogOpen] = useState(false)
  const propEntries = flattenTemplatePropDefinitions(props)
  const templateEditorBaseExtensions = useMemo(
    () => createTemplateEditorBaseExtensions(themePreference),
    [themePreference],
  )
  const completionExtension = useMemo(
    () => autocompletion({ override: [createTemplatePropCompletionSource(props)] }),
    [props],
  )
  const layoutExtension = useMemo(
    () =>
      EditorView.theme({
        "&": { minHeight },
        ".cm-scroller": { minHeight },
        ".cm-editor, .cm-content": {
          fontFamily: '"Geist Mono", "SFMono-Regular", "Roboto Mono", monospace',
        },
        ".cm-content": { flexGrow: "1", minHeight },
      }),
    [minHeight],
  )
  const editorExtensions = useMemo(
    () => [...templateEditorBaseExtensions, completionExtension, layoutExtension],
    [completionExtension, layoutExtension, templateEditorBaseExtensions],
  )

  return (
    <Box
      as="section"
      sx={{
        bg: surface === "card" ? "canvas.default" : "canvas.subtle",
        border: "1px solid",
        borderColor: "border.default",
        borderRadius: 2,
        display: "grid",
        overflow: "hidden",
      }}
      {...sectionProps}
    >
      <Box
        sx={{
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "border.default",
          display: "flex",
          gap: 3,
          justifyContent: "space-between",
          px: 3,
          py: 3,
        }}
      >
        <Box
          as="h4"
          sx={{
            fontSize: 2,
            fontWeight: "semibold",
            m: 0,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </Box>
        {badge ? (
          <Label variant="secondary" sx={{ fontFamily: "mono", flexShrink: 0 }}>
            {badge}
          </Label>
        ) : null}
      </Box>

      <Box sx={{ display: "grid", gap: 3, p: 3 }}>
        {propEntries.length > 0 ? (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "border.default",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                borderBottom: "1px solid",
                borderColor: "border.default",
                color: "fg.muted",
                fontSize: 0,
                fontWeight: "semibold",
                px: 3,
                py: 2,
              }}
            >
              PROP
            </Box>
            <Box
              data-template-prop-grid
              sx={{
                display: "grid",
                gap: 0,
                gridTemplateColumns: ["1fr", null, null, "1fr 1fr"],
                fontSize: 0,
              }}
            >
              {propEntries.map(({ path, definition }) => (
                <Box
                  key={path}
                  data-template-prop={path}
                  sx={{
                    alignItems: "center",
                    borderTop: "1px solid",
                    borderColor: "border.default",
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: "max-content minmax(0,1fr) max-content",
                    minWidth: 0,
                    px: 3,
                    py: 1,
                  }}
                >
                  <Text
                    sx={{
                      color: "success.fg",
                      fontFamily: "mono",
                      fontSize: 0,
                      fontWeight: "semibold",
                    }}
                  >
                    {path}
                  </Text>
                  <Text
                    sx={{
                      color: "fg.muted",
                      fontSize: "12px",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {definition.label}
                  </Text>
                  <Label size="small" sx={{ fontFamily: "mono", flexShrink: 0 }}>
                    {definition.type}
                  </Label>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        <Box
          data-template-code-section
          sx={{
            bg: "canvas.default",
            border: "1px solid",
            borderColor: "border.default",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              alignItems: "center",
              borderBottom: "1px solid",
              borderColor: "border.default",
              display: "flex",
              gap: 3,
              justifyContent: "space-between",
              px: 3,
              py: 2,
            }}
          >
            <Text sx={{ color: "fg.muted", fontSize: 0, fontWeight: "semibold" }}>CODE</Text>
            <Box sx={{ alignItems: "center", display: "flex", gap: 2 }}>
              <Button
                type="button"
                size="small"
                aria-label="템플릿 문법 도움말"
                onClick={() => setSyntaxDialogOpen(true)}
              >
                ?
              </Button>
              {presets.length > 0 ? (
                <ActionMenu>
                  <ActionMenu.Button
                    id={presetButtonId}
                    size="small"
                    disabled={readOnly && !onTemplateChange}
                  >
                    프리셋
                  </ActionMenu.Button>
                  <ActionMenu.Overlay align="end">
                    <ActionList>
                      {presets.map((preset) => (
                        <ActionList.Item
                          key={preset.id}
                          onSelect={() => onPresetApply?.(preset.template)}
                        >
                          {preset.label}
                        </ActionList.Item>
                      ))}
                    </ActionList>
                  </ActionMenu.Overlay>
                </ActionMenu>
              ) : null}
            </Box>
          </Box>
          <CodeMirror
            id={editorId}
            value={value}
            minHeight={minHeight}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            theme="none"
            editable={!readOnly}
            readOnly={readOnly}
            extensions={editorExtensions}
            onChange={(nextValue) => onTemplateChange?.(nextValue)}
          />
        </Box>
      </Box>

      {syntaxDialogOpen ? (
        <Dialog
          title="템플릿 문법"
          subtitle="중괄호 두 개 안에 JavaScript와 비슷한 식을 입력합니다."
          width="large"
          onClose={() => setSyntaxDialogOpen(false)}
        >
          <Box sx={{ display: "grid", gap: 3, fontSize: 1, lineHeight: "24px" }}>
            <Box sx={{ display: "grid", gap: 2 }}>
              <Text sx={{ fontWeight: "semibold" }}>기본</Text>
              <Box as="code" sx={codeSurfaceSx}>
                {"{{ title }}"}
              </Box>
              <Box as="code" sx={codeSurfaceSx}>
                {"{{ `![${alt}](${url})` }}"}
              </Box>
            </Box>
            <Box sx={{ display: "grid", gap: 2 }}>
              <Text sx={{ fontWeight: "semibold" }}>문자열</Text>
              <Box as="code" sx={codeSurfaceSx}>
                {"{{ '{{}}' }}"}
              </Box>
            </Box>
            {propEntries.length > 0 ? (
              <Box sx={{ display: "grid", gap: 2 }}>
                <Text sx={{ fontWeight: "semibold" }}>자동완성</Text>
                <Text sx={{ color: "fg.muted" }}>
                  {"{{ "} 뒤에 변수 이름을 입력하면 사용할 수 있는 prop을 자동완성합니다.
                </Text>
              </Box>
            ) : null}
          </Box>
        </Dialog>
      ) : null}
    </Box>
  )
}
