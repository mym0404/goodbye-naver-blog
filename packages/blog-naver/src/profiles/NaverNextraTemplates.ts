const safeTableTemplate =
  "{{ rows.length > 0 ? rows[0][0].isHeader ? `| ${rows[0].map(cell => cell.text).join(' | ')} |\\n| ${rows[0].map(cell => '---').join(' | ')} |${rows.slice(1).length ? `\\n${rows.slice(1).map(row => `| ${row.map(cell => cell.text).join(' | ')} |`).join('\\n')}` : ''}` : `| ${rows[0].map(cell => ' ').join(' | ')} |\\n| ${rows[0].map(cell => '---').join(' | ')} |\\n${rows.map(row => `| ${row.map(cell => cell.text).join(' | ')} |`).join('\\n')}` : '' }}"

const quoteTemplate = "<Callout>\n{{ text }}\n</Callout>"
const imageTemplate = '<img src="{{ url }}" alt="{{ alt }}" />\n{{ caption ? caption : \'\' }}'
const imageListTemplate =
  "{{ images.map(image => `<img src=\"${image.url}\" alt=\"${image.alt}\" />${image.caption ? `\\n${image.caption}` : ''}`).join('\\n\\n') }}"

export const naverNextraTemplates: Partial<Record<string, string>> = {
  "naver-se2:quote": quoteTemplate,
  "naver-se3:quote": quoteTemplate,
  "naver-se4:quote": quoteTemplate,
  "naver-se2:table": safeTableTemplate,
  "naver-se3:table": safeTableTemplate,
  "naver-se4:table": safeTableTemplate,
  "naver-se4:formula": "{{ `\\`\\`\\`latex\\n${formula}\\n\\`\\`\\`` }}",
  "naver-se2:image": imageTemplate,
  "naver-se3:image": imageTemplate,
  "naver-se4:image": imageTemplate,
  "naver-se3:imageStrip": imageListTemplate,
  "naver-se4:imageStrip": imageListTemplate,
  "naver-se4:imageGroup": imageListTemplate,
}
