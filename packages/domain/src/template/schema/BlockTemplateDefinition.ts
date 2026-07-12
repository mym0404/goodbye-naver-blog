export const allTemplatePropTypes = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "string?",
  "number?",
  "boolean?",
  "object?",
  "array?",
] as const
// Template prop shape exposed to autocomplete and documentation.
export type TemplatePropType = (typeof allTemplatePropTypes)[number]

type TemplateScalarPropType = Exclude<TemplatePropType, "object" | "object?" | "array" | "array?">

type TemplatePropMetadata = {
  label: string
  description?: string
}

// Recursive schema for one template interpolation prop.
export type TemplatePropDefinition = TemplatePropMetadata &
  (
    | {
        type: TemplateScalarPropType
        properties?: never
        items?: never
      }
    | {
        type: "object" | "object?"
        properties: Record<string, TemplatePropDefinition>
        items?: never
      }
    | {
        type: "array" | "array?"
        items: TemplatePropDefinition
        properties?: never
      }
  )

export type BlockTemplatePreset = {
  id: string
  label: string
  template: string
}

// A block template describes renderer presets and available interpolation props.
export type BlockTemplateDefinition = {
  key: string
  label: string
  presets: [BlockTemplatePreset, ...BlockTemplatePreset[]]
  props: Record<string, TemplatePropDefinition>
}
