import { expect, it } from "vitest"

import type { TemplatePropDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

import { flattenTemplatePropDefinitions } from "./TemplatePropDefinitions.js"

it("flattens nested object and array prop paths", () => {
  const props = {
    images: {
      label: "이미지 목록",
      type: "array",
      items: {
        label: "이미지",
        type: "object",
        properties: {
          url: { label: "URL", type: "string" },
          caption: { label: "캡션", type: "string?" },
        },
      },
    },
    rows: {
      label: "행",
      type: "array",
      items: {
        label: "셀 목록",
        type: "array",
        items: {
          label: "셀",
          type: "object",
          properties: {
            text: { label: "텍스트", type: "string" },
          },
        },
      },
    },
  } satisfies Record<string, TemplatePropDefinition>

  expect(flattenTemplatePropDefinitions(props).map(({ path }) => path)).toEqual([
    "images",
    "images[].url",
    "images[].caption",
    "rows",
    "rows[][].text",
  ])
})
