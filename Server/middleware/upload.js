const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'pdfs'),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${unique}.pdf`);
  },
});

function fileFilter(req, file, cb) {
  const hasPdfExtension = path.extname(file.originalname).toLowerCase() === '.pdf';
  if (file.mimetype !== 'application/pdf' || !hasPdfExtension) {
    const err = new Error('Only PDF files are allowed');
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

module.exports = { uploadPdf };
