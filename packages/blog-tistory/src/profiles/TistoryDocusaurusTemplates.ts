export const tistoryDocusaurusTemplates: Partial<Record<string, string>> = {
  "tistory:quote": ":::note[원문 인용]\n{{ text }}\n:::",
  "tistory:table":
    "{{ `| ${headers.join(' | ')} |\\n| ${headers.map(header => '---').join(' | ')} |${rows.length ? `\\n${rows.map(row => `| ${row.join(' | ')} |`).join('\\n')}` : ''}` }}",
  "tistory:tableOfContents": "<TOCInline toc={toc} />",
}
