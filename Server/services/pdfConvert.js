const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'uploads', 'pages');

function runPdftoppm(pdfPath, outPrefix) {
  return new Promise((resolve, reject) => {
    execFile('pdftoppm', ['-png', '-r', '150', pdfPath, outPrefix], (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve();
    });
  });
}

// Converts a PDF into one PNG per page under uploads/pages/<paperId>/, returning
// [{ pageNumber, imagePath }] sorted by page number. imagePath is relative to uploads/pages.
async function convertPdfToImages(pdfPath, paperId) {
  const outDir = path.join(PAGES_DIR, String(paperId));
  await fs.mkdir(outDir, { recursive: true });
  const outPrefix = path.join(outDir, 'page');

  await runPdftoppm(pdfPath, outPrefix);

  const files = await fs.readdir(outDir);
  const pages = files
    .filter((f) => /^page-\d+\.png$/.test(f))
    .map((f) => {
      const pageNumber = parseInt(f.match(/^page-(\d+)\.png$/)[1], 10);
      return { pageNumber, imagePath: path.join(String(paperId), f) };
    })
    .sort((a, b) => a.pageNumber - b.pageNumber);

  return pages;
}

module.exports = { convertPdfToImages, PAGES_DIR };
