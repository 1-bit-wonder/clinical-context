export function chunkText(text, chunkSize = 2000, overlap = 400) {
  const chunks = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end >= text.length) {
      // Last chunk: take everything remaining
      const content = text.slice(start).trim();
      if (content.length >= 100) {
        chunks.push({ content, chunkIndex: chunkIndex++ });
      }
      break;
    }

    // Try to split on double newline within the chunk window
    let splitAt = -1;
    const searchRegion = text.slice(start, end);

    const doubleNewline = searchRegion.lastIndexOf('\n\n');
    if (doubleNewline !== -1 && doubleNewline > 0) {
      splitAt = start + doubleNewline;
    } else {
      const singleNewline = searchRegion.lastIndexOf('\n');
      if (singleNewline !== -1 && singleNewline > 0) {
        splitAt = start + singleNewline;
      } else {
        // Fall back to last space to avoid splitting mid-word
        const lastSpace = searchRegion.lastIndexOf(' ');
        splitAt = lastSpace !== -1 ? start + lastSpace : end;
      }
    }

    const content = text.slice(start, splitAt).trim();
    if (content.length >= 100) {
      chunks.push({ content, chunkIndex: chunkIndex++ });
    }

    // Next chunk starts (splitAt - overlap) to create overlap
    start = Math.max(splitAt - overlap, start + 1);
  }

  return chunks;
}
