import multer from 'multer';

// Files are held in memory and then saved to the database (see PatientDocument), not to local disk.
export const uploadDocument = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single('document');

export const storedFileName = (originalName: string): string =>
  `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
