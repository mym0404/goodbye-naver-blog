import { getParserCapabilityId, parserCapabilityCatalog } from "./block-registry.js"

import type {
  AstBlock,
  EditorVersion,
  ParserCapability,
  ParserCapabilityId,
  ParserCapabilityLookupId,
} from "./types.js"

export { getParserCapabilityId }

export const getParserCapabilityLookupIds = ({
  editorVersion,
  blocks,
  warnings: _warnings,
}: {
  editorVersion: EditorVersion
  blocks: AstBlock[]
  warnings: string[]
}) => {
  const sourceCapabilityUsage = new Map<ParserCapabilityId, number>()

  blocks.forEach((block) => {
    const capabilityId = getParserCapabilityId({
      editorVersion,
      blockType: block.type,
    })

    sourceCapabilityUsage.set(capabilityId, (sourceCapabilityUsage.get(capabilityId) ?? 0) + 1)
  })

  const lookupIds: ParserCapabilityLookupId[] = []

  sourceCapabilityUsage.forEach((_, capabilityId) => {
    lookupIds.push(capabilityId)
  })

  return lookupIds
}

export const parserCapabilities: ParserCapability[] = parserCapabilityCatalog.map((capability) => {
  const id = getParserCapabilityId({
    editorVersion: capability.editorVersion,
    blockType: capability.blockType,
  })

  return {
    id,
    ...capability,
  }
})
