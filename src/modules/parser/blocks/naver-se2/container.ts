import type { CheerioAPI } from "cheerio"

import type { ParserBlock } from "../parser-node.js"
import { compactText } from "../../../../shared/utils.js"

const nestedBlockContainerTags = new Set(["div", "span", "font"])
const spacerContainerTags = new Set(["p", "div", "span", "font", "b", "strong", "i", "em", "u"])
const nestedBlockTags = new Set([
  "p",
  "div",
  "table",
  "blockquote",
  "hr",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
])

const shouldTraverseNestedBlocks = ({
  element,
  tagName,
}: {
  element: ReturnType<CheerioAPI>
  tagName: string
}) => {
  if (!nestedBlockContainerTags.has(tagName)) {
    return false
  }

  const childNodes = element.contents().toArray()
  const hasMeaningfulDirectText = childNodes.some(
    (node) => node.type === "text" && compactText(node.data ?? "") !== "",
  )

  if (hasMeaningfulDirectText) {
    return false
  }

  return childNodes.some(
    (node) => node.type === "tag" && nestedBlockTags.has(node.tagName.toLowerCase()),
  )
}

const isSpacerBlock = ({
  element,
  tagName,
}: {
  element: ReturnType<CheerioAPI>
  tagName: string
}) => {
  if (!spacerContainerTags.has(tagName)) {
    return false
  }

  const clone = element.clone()

  clone.find("br").remove()

  if (clone.find("img,iframe,video,table").length > 0) {
    return false
  }

  return compactText(clone.text()) === ""
}

export const se2ContainerBlock: ParserBlock = {
  id: "se2-container",
  kind: "container",
  match: ({ node, $node }) =>
    node.type === "tag" &&
    shouldTraverseNestedBlocks({
      element: $node,
      tagName: node.tagName.toLowerCase(),
    }),
  convert: ({ $node }) => ({
    status: "traverse",
    nodes: $node.contents().toArray(),
  }),
}

export const se2DividerBlock: ParserBlock = {
  id: "se2-divider",
  kind: "leaf",
  match: ({ node }) => node.type === "tag" && node.tagName.toLowerCase() === "hr",
  convert: () => ({
    status: "handled",
    blocks: [{ type: "divider" }],
  }),
}

export const se2LineBreakBlock: ParserBlock = {
  id: "se2-line-break",
  kind: "leaf",
  match: ({ node }) => node.type === "tag" && node.tagName.toLowerCase() === "br",
  convert: () => ({ status: "skip" }),
}

export const se2SpacerBlock: ParserBlock = {
  id: "se2-spacer",
  kind: "leaf",
  match: ({ node, $node }) =>
    node.type === "tag" &&
    isSpacerBlock({
      element: $node,
      tagName: node.tagName.toLowerCase(),
    }),
  convert: () => ({ status: "skip" }),
}
