export const tistoryNextraTemplates: Partial<Record<string, string>> = {
  "tistory:image":
    "{{ images.map(image => `<img src=\"${image.url}\" alt=\"${image.alt}\" />${image.caption ? `\\n${image.caption}` : ''}`).join('\\n\\n') }}",
  "tistory:quote": "<Callout>\n{{ text }}\n</Callout>",
  "tistory:table":
    "{{ `| ${headers.join(' | ')} |\\n| ${headers.map(header => '---').join(' | ')} |${rows.length ? `\\n${rows.map(row => `| ${row.join(' | ')} |`).join('\\n')}` : ''}` }}",
}
