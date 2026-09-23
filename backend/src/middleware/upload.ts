import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDirectory = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
});
export const uploadDocument = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single('document');
