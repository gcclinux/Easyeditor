import fs from 'fs';
import mammoth from 'mammoth';

async function generate() {
  const result = await mammoth.convertToHtml({ buffer: fs.readFileSync('.local/sample3.docx') }, {
      preserveEmptyParagraphs: false,
      styleMap: [
        "table => table",
        "tr => tr",
        "td => td",
        "th => th"
      ]
  });
  fs.writeFileSync('output.html', result.value);
}
generate();
