import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryFileBlock extends TistoryParserBlock {
  readonly id = "file"
  readonly label = "첨부파일"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      { id: "file-link", label: "파일 링크", template: "{{ `[${fileName}](${fileUrl})` }}" },
    ],
    props: {
      fileName: { label: "파일명", type: "string" },
      fileUrl: { label: "파일 URL", type: "string" },
    },
  } as const

  match({ $node }: TistoryParserBlockContext) {
    const href = $node.find("a[href]").first().attr("href") ?? $node.attr("href") ?? ""

    return (
      $node.attr("data-ke-type") === "file" ||
      $node.hasClass("fileblock") ||
      /(?:attachment|cfile|download)/i.test(href)
    )
  }

  convert({ $node, options }: TistoryParserBlockContext) {
    const $link = $node.is("a[href]") ? $node : $node.find("a[href]").first()
    const rawUrl = $link.attr("href")?.trim()

    if (!rawUrl) {
      return []
    }

    return [
      {
        blockId: `tistory:${this.id}`,
        props: {
          fileName:
            $link.attr("download")?.trim() ||
            $link.text().trim() ||
            rawUrl.split("/").at(-1) ||
            "file",
          fileUrl: options.resolveLinkUrl ? options.resolveLinkUrl(rawUrl) : rawUrl,
        },
      },
    ]
  }
}
