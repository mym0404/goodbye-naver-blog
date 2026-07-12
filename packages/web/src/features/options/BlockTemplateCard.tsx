import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

import { TemplateEditorCard } from "./TemplateEditorCard.js"

const toBlockTemplateControlId = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, "-")

const getDefaultTemplate = (definition: BlockTemplateDefinition) => definition.presets[0].template

export const getEffectiveBlockTemplate = ({
  definition,
  template,
  defaultTemplate,
}: {
  definition: BlockTemplateDefinition
  template?: string
  defaultTemplate?: string
}) => template ?? defaultTemplate ?? getDefaultTemplate(definition)

export const BlockTemplateCard = ({
  definition,
  template,
  defaultTemplate,
  themePreference,
  readOnly = false,
  onTemplateChange,
}: {
  definition: BlockTemplateDefinition
  template?: string
  defaultTemplate?: string
  themePreference: ThemePreference
  readOnly?: boolean
  onTemplateChange?: (template: string) => void
}) => {
  const controlId = toBlockTemplateControlId(definition.key)
  const effectiveTemplate = getEffectiveBlockTemplate({ definition, template, defaultTemplate })

  return (
    <TemplateEditorCard
      title={definition.label}
      badge={definition.key}
      editorId={`block-template-editor-${controlId}`}
      presetButtonId={`block-template-preset-${controlId}`}
      presets={definition.presets}
      props={definition.props}
      value={effectiveTemplate}
      themePreference={themePreference}
      readOnly={readOnly}
      data-block-template-card={definition.key}
      onPresetApply={onTemplateChange}
      onTemplateChange={onTemplateChange}
    />
  )
}
