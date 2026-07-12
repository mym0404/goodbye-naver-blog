import { describe, expect, it } from "vitest"

import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

import { getEffectiveBlockTemplate } from "./BlockTemplateCard.js"

const definition = {
  key: "naver-se4:image",
  label: "이미지",
  presets: [
    {
      id: "default",
      label: "이미지 마크다운",
      template: "{{ `![${alt}](${url})` }}",
    },
    {
      id: "link",
      label: "이미지 링크",
      template: "{{ url }}",
    },
  ],
  props: {},
} satisfies BlockTemplateDefinition

describe("getEffectiveBlockTemplate", () => {
  it("keeps an empty editor template so the block can be omitted", () => {
    expect(getEffectiveBlockTemplate({ definition, template: "" })).toBe("")
  })

  it("keeps a custom editor template", () => {
    expect(getEffectiveBlockTemplate({ definition, template: "{{ url }}" })).toBe("{{ url }}")
  })
})
