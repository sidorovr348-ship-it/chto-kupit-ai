const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

function run(command, args, inputFile) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30000, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve(String(stdout || ''));
    });
  });
}

function stripXml(xml) {
  return String(xml)
    .replace(/<w:tab\s*\/?>/g, '\t')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocumentText(buffer, filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const tmp = path.join(os.tmpdir(), `my-ai-unified-${Date.now()}-${Math.random().toString(36).slice(2)}` + ext);
  fs.writeFileSync(tmp, buffer);
  try {
    if (['.txt', '.md', '.json', '.xml', '.html', '.htm', '.log'].includes(ext)) {
      return { text: buffer.toString('utf8'), kind: 'text' };
    }
    if (['.csv', '.tsv'].includes(ext)) {
      return { text: buffer.toString('utf8'), kind: 'table' };
    }
    if (ext === '.pdf') {
      const text = await run('pdftotext', ['-layout', tmp, '-']);
      return { text, kind: 'document' };
    }
    if (ext === '.docx') {
      const xml = await run('unzip', ['-p', tmp, 'word/document.xml']);
      return { text: stripXml(xml), kind: 'document' };
    }
    if (ext === '.xlsx') {
      const shared = await run('unzip', ['-p', tmp, 'xl/sharedStrings.xml']).catch(() => '');
      const sheet = await run('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml']);
      const strings = [];
      const sharedMatches = shared.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      for (const match of sharedMatches) strings.push(stripXml(match));
      const rows = [];
      for (const row of sheet.match(/<row[\s\S]*?<\/row>/g) || []) {
        const cells = [];
        for (const cell of row.match(/<c[\s\S]*?<\/c>/g) || []) {
          const type = /\bt="([^"]+)"/.exec(cell)?.[1] || '';
          const value = stripXml(/<v>([\s\S]*?)<\/v>/.exec(cell)?.[0] || '');
          cells.push(type === 's' ? (strings[Number(value)] || '') : value);
        }
        if (cells.length) rows.push(cells.join('\t'));
      }
      return { text: rows.join('\n'), kind: 'table' };
    }
    throw Object.assign(new Error(`Неподдерживаемый тип файла: ${ext || 'без расширения'}`), { status: 415 });
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

module.exports = { extractDocumentText };
