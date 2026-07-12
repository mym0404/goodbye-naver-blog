// Static Storybook fixture metadata used before Markdown generation.
export type StorybookDefinition = {
  storyKey: string
  editorType: string
  editorLabel: string
  blockIndex: number
  blockId: string
  blockLabel: string
  sourceUrl: string
  inspectPath?: string
  inputHtml: string
  screenshotSrc: string
}
