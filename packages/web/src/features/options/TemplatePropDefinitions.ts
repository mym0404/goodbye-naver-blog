import type { TemplatePropDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

const isObjectProp = (definition: TemplatePropDefinition) =>
  definition.type === "object" || definition.type === "object?"

const isArrayProp = (definition: TemplatePropDefinition) =>
  definition.type === "array" || definition.type === "array?"

export const getTemplatePropProperties = (definition: TemplatePropDefinition) =>
  isObjectProp(definition) ? definition.properties : undefined

export const getTemplatePropItems = (definition: TemplatePropDefinition) =>
  isArrayProp(definition) ? definition.items : undefined

const flattenNestedTemplateProps = ({
  path,
  definition,
}: {
  path: string
  definition: TemplatePropDefinition
}): { path: string; definition: TemplatePropDefinition }[] => {
  const properties = getTemplatePropProperties(definition)

  if (properties) {
    return Object.entries(properties).flatMap(([key, property]) => {
      const propertyPath = `${path}.${key}`

      return [
        { path: propertyPath, definition: property },
        ...flattenNestedTemplateProps({ path: propertyPath, definition: property }),
      ]
    })
  }

  const items = getTemplatePropItems(definition)

  if (!items) {
    return []
  }

  const itemPath = `${path}[]`

  if (getTemplatePropProperties(items) || getTemplatePropItems(items)) {
    return flattenNestedTemplateProps({ path: itemPath, definition: items })
  }

  return [{ path: itemPath, definition: items }]
}

export const flattenTemplatePropDefinitions = (props: Record<string, TemplatePropDefinition>) =>
  Object.entries(props).flatMap(([path, definition]) => [
    { path, definition },
    ...flattenNestedTemplateProps({ path, definition }),
  ])

export const resolveTemplatePropPath = ({
  path,
  props,
  bindings,
}: {
  path: string
  props: Record<string, TemplatePropDefinition>
  bindings: Map<string, TemplatePropDefinition>
}) => {
  const [root, ...segments] = path.split(".")
  let definition: TemplatePropDefinition | undefined = bindings.get(root ?? "") ?? props[root ?? ""]

  for (const segment of segments) {
    if (!definition) {
      return undefined
    }

    definition = getTemplatePropProperties(definition)?.[segment]
  }

  return definition
}
