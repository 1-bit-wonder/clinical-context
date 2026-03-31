import fs from 'fs';
import pdfParse from 'pdf-parse';

export async function extractText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  const text = data.text?.trim();
  if (!text) {
    throw new Error(`No text content extracted from ${filePath}`);
  }

  return text;
}
