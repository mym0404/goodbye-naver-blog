import { describe, expect, it } from "vitest"

import { createTemplatePropCompletionSource } from "./TemplatePropAutocomplete.js"

const props = {
  caption: { label: "캡션", type: "string?" },
  slug: { label: "Slug", type: "string" },
  url: { label: "URL", type: "string" },
  metadata: {
    label: "메타데이터",
    type: "object",
    properties: {
      title: { label: "제목", type: "string" },
      thumbnail: { label: "썸네일", type: "string?" },
    },
  },
  images: {
    label: "이미지 목록",
    type: "array",
    items: {
      label: "이미지",
      type: "object",
      properties: {
        url: { label: "URL", type: "string" },
        alt: { label: "대체 텍스트", type: "string" },
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
          html: { label: "HTML", type: "string" },
        },
      },
    },
  },
} as const

const getCompletionLabels = ({
  template,
  cursor = template.length,
}: {
  template: string
  cursor?: number
}) => {
  const source = createTemplatePropCompletionSource(props)

  return (
    source({
      explicit: true,
      pos: cursor,
      state: {
        doc: {
          sliceString: (from: number, to: number) => template.slice(from, to),
        },
      },
    })?.options.map((option) => option.label) ?? []
  )
}

describe("createTemplatePropCompletionSource", () => {
  it("suggests matching props inside template expressions", () => {
    expect(getCompletionLabels({ template: "{{ c" })).toEqual(["caption"])
  })

  it("does not suggest props outside template expressions", () => {
    expect(getCompletionLabels({ template: "caption" })).toEqual([])
    expect(getCompletionLabels({ template: "{{ caption }} text" })).toEqual([])
  })

  it("suggests direct object properties", () => {
    expect(getCompletionLabels({ template: "{{ metadata." })).toEqual(["title", "thumbnail"])
  })

  it("suggests array item properties inside map callbacks", () => {
    expect(getCompletionLabels({ template: "{{ images.map(image => image." })).toEqual([
      "url",
      "alt",
    ])
  })

  it("suggests nested array item properties inside nested map callbacks", () => {
    expect(getCompletionLabels({ template: "{{ rows.map(row => row.map(cell => cell." })).toEqual([
      "text",
      "html",
    ])
  })
})
