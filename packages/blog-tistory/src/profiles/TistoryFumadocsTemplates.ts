export const tistoryFumadocsTemplates: Partial<Record<string, string>> = {
  "tistory:image":
    "{{ images.map(image => `<img src=\"${image.url}\" alt=\"${image.alt}\" unoptimized />${image.caption ? `\\n${image.caption}` : ''}`).join('\\n\\n') }}",
  "tistory:quote":
    '<Accordions>\n<Accordion title="원문 인용">\n{{ text }}\n</Accordion>\n</Accordions>',
  "tistory:table":
    "{{ `| ${headers.join(' | ')} |\\n| ${headers.map(header => '---').join(' | ')} |${rows.length ? `\\n${rows.map(row => `| ${row.join(' | ')} |`).join('\\n')}` : ''}` }}",
  "tistory:tableOfContents": "<InlineTOC />",
}
