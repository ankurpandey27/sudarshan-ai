import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfToText(buffer: Buffer): Promise<string> {
  // Silences pdf.js font warnings ("TT: undefined function").
  const pdf = await getDocumentProxy(new Uint8Array(buffer), { verbosity: 0 });
  const { text } = await extractText(pdf, { mergePages: false });
  const joined = (Array.isArray(text) ? text : [text]).join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
  if (joined.replace(/\s/g, '').length < 50) {
    throw new Error('This PDF has no selectable text (it is probably a scanned image). Export your resume as a text PDF.');
  }
  return joined;
}
