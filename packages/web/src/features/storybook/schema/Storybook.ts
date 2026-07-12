import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

import type { StorybookDefinition } from "./StorybookDefinition.js"

// Rendered Storybook case paired with its Markdown output.
export type StorybookStory = StorybookDefinition & {
  markdown: string
  templateDefinition: BlockTemplateDefinition
}

// Storybook cases grouped by blog editor family for the UI.
export type StorybookEditorGroup = {
  editorType: string
  editorLabel: string
  stories: StorybookStory[]
}
