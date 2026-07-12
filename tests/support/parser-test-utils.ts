import { NaverBlogSE2Editor } from "@exitpress/blog-naver/parsing/naver-blog/se2/NaverBlogSe2Editor.js"
import { NaverBlogSE3Editor } from "@exitpress/blog-naver/parsing/naver-blog/se3/NaverBlogSe3Editor.js"
import { NaverBlogSE4Editor } from "@exitpress/blog-naver/parsing/naver-blog/se4/NaverBlogSe4Editor.js"
import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { renderTemplateExpressions } from "@exitpress/domain/template/util/renderTemplateExpressions.js"
import { load } from "cheerio"
import { expect } from "vitest"

import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type {
  BlockTemplateDefinition,
  TemplatePropDefinition,
} from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"
import type { TemplateValue } from "@exitpress/domain/template/schema/TemplateValue.js"

const testOptions = defaultExportOptions()

const allEditorTypes = ["naver-se2", "naver-se3", "naver-se4"] as const
type EditorType = (typeof allEditorTypes)[number]

type ParserTestOptions = {
  blockOutputs?: ExportOptions["blockOutputs"]
}

const createParserOptions = ({ blockOutputs }: ParserTestOptions = {}) => ({
  blockOutputs: blockOutputs ?? testOptions.blockOutputs,
})

const se2Editor = new NaverBlogSE2Editor()
const se3Editor = new NaverBlogSE3Editor()
const se4Editor = new NaverBlogSE4Editor()

const sourceUrl = "https://blog.naver.com/mym0404/123456789"

export const createSe4ModuleScript = (module: Record<string, unknown>) =>
  `<script class="__se_module_data" data-module-v2='${JSON.stringify(module)}'></script>`

export const parseSe2Blocks = (content: string, options?: ParserTestOptions) =>
  se2Editor.parse({
    $: load(`<div id="viewTypeSelector">${content}</div>`),
    tags: ["classic", "classic", "archive"],
    options: createParserOptions(options),
  })

const createSe3Html = (...components: string[]) =>
  `<div id="viewTypeSelector"><div class="se_component_wrap sect_dsc">${components.join("")}</div></div>`

export const parseSe3Blocks = (...components: string[]) =>
  se3Editor.parse({
    $: load(createSe3Html(...components)),
    tags: ["daily", "daily", "archive"],
    options: createParserOptions(),
  })

export const parseSe3BlocksWithOptions = ({
  blockOutputs,
  components,
}: {
  blockOutputs: ExportOptions["blockOutputs"]
  components: string[]
}) =>
  se3Editor.parse({
    $: load(createSe3Html(...components)),
    tags: ["daily", "daily", "archive"],
    options: createParserOptions({ blockOutputs }),
  })

export const parseSe4Blocks = (...components: string[]) =>
  se4Editor.parse({
    $: load(`<div id="viewTypeSelector">${components.join("")}</div>`),
    sourceUrl,
    tags: ["algo", "algo", "math"],
    options: createParserOptions(),
  })

export const parseSe4BlocksWithOptions = ({
  blockOutputs,
  components,
}: {
  blockOutputs: ExportOptions["blockOutputs"]
  components: string[]
}) =>
  se4Editor.parse({
    $: load(`<div id="viewTypeSelector">${components.join("")}</div>`),
    sourceUrl,
    tags: ["algo", "algo", "math"],
    options: createParserOptions({ blockOutputs }),
  })

const editorDefinitions: Record<EditorType, () => BlockTemplateDefinition[]> = {
  "naver-se2": () => se2Editor.getBlockTemplateDefinitions(),
  "naver-se3": () => se3Editor.getBlockTemplateDefinitions(),
  "naver-se4": () => se4Editor.getBlockTemplateDefinitions(),
}

const getBlockTemplateDefinition = ({
  editorType,
  blockId,
}: {
  editorType: EditorType
  blockId: string
}) => {
  const selectionKey = `${editorType}:${blockId}`
  const definition = editorDefinitions[editorType]().find(
    (candidate) => candidate.key === selectionKey,
  )

  if (!definition) {
    throw new Error(`Missing parser block template definition: ${selectionKey}`)
  }

  return definition
}

const isOptionalProp = (definition: TemplatePropDefinition) => definition.type.endsWith("?")

const getRequiredPropType = (definition: TemplatePropDefinition) =>
  definition.type.replace(/\?$/, "")

const createRepresentativeValue = ({
  definition,
  omitOptional,
}: {
  definition: TemplatePropDefinition
  omitOptional: boolean
}): TemplateValue => {
  if (omitOptional && isOptionalProp(definition)) {
    return undefined
  }

  switch (getRequiredPropType(definition)) {
    case "string":
      return "value"
    case "number":
      return 1
    case "boolean":
      return true
    case "object":
      return Object.fromEntries(
        Object.entries(definition.properties ?? {}).map(([key, property]) => [
          key,
          createRepresentativeValue({ definition: property, omitOptional }),
        ]),
      )
    case "array": {
      const item = definition.items
        ? createRepresentativeValue({ definition: definition.items, omitOptional })
        : undefined

      return item === undefined ? [] : [item]
    }
  }
}

const createRepresentativeProps = ({
  definition,
  omitOptional,
}: {
  definition: BlockTemplateDefinition
  omitOptional: boolean
}) =>
  Object.fromEntries(
    Object.entries(definition.props).map(([key, prop]) => [
      key,
      createRepresentativeValue({ definition: prop, omitOptional }),
    ]),
  )

const expectValueToMatchProp = ({
  definition,
  value,
  path,
}: {
  definition: TemplatePropDefinition
  value: TemplateValue
  path: string
}) => {
  if (value === undefined || value === null) {
    expect(isOptionalProp(definition), `${path} should be present`).toBe(true)
    return
  }

  switch (getRequiredPropType(definition)) {
    case "string":
      expect(typeof value, `${path} should be a string`).toBe("string")
      return
    case "number":
      expect(typeof value, `${path} should be a number`).toBe("number")
      return
    case "boolean":
      expect(typeof value, `${path} should be a boolean`).toBe("boolean")
      return
    case "array":
      expect(Array.isArray(value), `${path} should be an array`).toBe(true)

      if (Array.isArray(value) && definition.items) {
        value.forEach((item, index) =>
          expectValueToMatchProp({
            definition: definition.items!,
            value: item,
            path: `${path}[${index}]`,
          }),
        )
      }
      return
    case "object": {
      expect(
        typeof value === "object" && !Array.isArray(value),
        `${path} should be an object`,
      ).toBe(true)

      if (typeof value !== "object" || Array.isArray(value)) {
        return
      }

      const properties = definition.properties ?? {}

      expect(
        Object.keys(value).filter((key) => !Object.hasOwn(properties, key)),
        `${path} has undocumented properties`,
      ).toEqual([])
      Object.entries(properties).forEach(([key, property]) => {
        const propertyValue = value[key]

        if (!Object.hasOwn(value, key) && !isOptionalProp(property)) {
          expect.fail(`${path}.${key} should be present`)
        }

        expectValueToMatchProp({
          definition: property,
          value: propertyValue,
          path: `${path}.${key}`,
        })
      })
    }
  }
}

const expectPropsToMatchDefinition = ({
  definition,
  props,
}: {
  definition: BlockTemplateDefinition
  props: Record<string, TemplateValue>
}) => {
  expect(Object.keys(props).filter((key) => !Object.hasOwn(definition.props, key))).toEqual([])

  Object.entries(definition.props).forEach(([key, prop]) => {
    if (!Object.hasOwn(props, key) && !isOptionalProp(prop)) {
      expect.fail(`${definition.key}.${key} should be present`)
    }

    expectValueToMatchProp({
      definition: prop,
      value: props[key],
      path: `${definition.key}.${key}`,
    })
  })
}

const expectPresetsToRender = ({
  definition,
  actualProps,
}: {
  definition: BlockTemplateDefinition
  actualProps: Record<string, TemplateValue>
}) => {
  const ids = definition.presets.map(({ id }) => id)
  const labels = definition.presets.map(({ label }) => label)

  expect(new Set(ids).size, `${definition.key} has duplicate preset IDs`).toBe(ids.length)
  expect(new Set(labels).size, `${definition.key} has duplicate preset labels`).toBe(labels.length)

  const representativeProps = createRepresentativeProps({ definition, omitOptional: false })
  const omittedOptionalProps = createRepresentativeProps({ definition, omitOptional: true })

  definition.presets.forEach((preset) => {
    if (!preset.template.trim()) {
      expect(
        (preset.id === "ignore" && preset.label === "무시") ||
          (preset.id === "children" && preset.label === "하위 블록"),
        `${definition.key}:${preset.id} must explicitly be an ignore or child-delegation preset`,
      ).toBe(true)
      return
    }

    ;[actualProps, representativeProps, omittedOptionalProps].forEach((props) => {
      let rendered = ""

      try {
        rendered = renderTemplateExpressions({ template: preset.template, props })
      } catch (error) {
        throw new Error(
          `${definition.key}:${preset.id} failed to render: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      expect(rendered).not.toContain("undefined")
    })

    expect(
      renderTemplateExpressions({ template: preset.template, props: representativeProps }).trim(),
      `${definition.key}:${preset.id} should render representative props`,
    ).not.toBe("")
  })
}

export const expectBlockTemplateCatalog = (definitions: BlockTemplateDefinition[]) => {
  definitions.forEach((definition) => {
    const representativeProps = createRepresentativeProps({ definition, omitOptional: false })

    expectPresetsToRender({ definition, actualProps: representativeProps })
  })
}

export const expectBlockTemplateDefinition = ({
  editorType,
  blockId,
  parse,
  blockIndex = 0,
}: {
  editorType: EditorType
  blockId: string
  parse: (blockOutputs: ExportOptions["blockOutputs"]) => { blocks: ParsedBlock[] }
  blockIndex?: number
}) => {
  const definition = getBlockTemplateDefinition({ editorType, blockId })

  expect(definition.presets.length).toBeGreaterThanOrEqual(1)
  expect(definition.props).toEqual(expect.any(Object))

  const parsed = parse({
    templates: {},
  })

  const parsedBlock = parsed.blocks[blockIndex]

  expect(parsedBlock).toEqual(expect.any(Object))

  if (!parsedBlock) {
    return
  }

  expectPropsToMatchDefinition({ definition, props: parsedBlock.props })
  expectPresetsToRender({ definition, actualProps: parsedBlock.props })
}
