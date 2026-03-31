export function chunkText(text, chunkSize = 2000, overlap = 400) {
  const chunks = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);

    if (end === text.length) {
      const content = text.slice(start).trim();
      if (content.length >= 100) {
        chunks.push({ content, chunkIndex: chunkIndex++ });
      }
      break;
    }

    // Only search the latter half of the window for a split point.
    // This guarantees splitAt is always at least (chunkSize / 2) ahead of
    // start, preventing near-infinite loops when \n\n appears near the top
    // of the window.
    const minSplit = start + Math.floor(chunkSize / 2);
    const searchRegion = text.slice(minSplit, end);

    let splitAt = end; // fallback: hard cut

    const doubleNewline = searchRegion.lastIndexOf('\n\n');
    if (doubleNewline !== -1) {
      splitAt = minSplit + doubleNewline;
    } else {
      const singleNewline = searchRegion.lastIndexOf('\n');
      if (singleNewline !== -1) {
        splitAt = minSplit + singleNewline;
      } else {
        const lastSpace = searchRegion.lastIndexOf(' ');
        if (lastSpace !== -1) splitAt = minSplit + lastSpace;
      }
    }

    const content = text.slice(start, splitAt).trim();
    if (content.length >= 100) {
      chunks.push({ content, chunkIndex: chunkIndex++ });
    }

    start = splitAt - overlap;
  }

  return chunks;
}
