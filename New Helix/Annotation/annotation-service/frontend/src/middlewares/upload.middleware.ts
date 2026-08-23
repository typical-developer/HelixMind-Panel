import multer from "multer";
import path from "path";

// Define the allowed extensions for HelixAI
const ALLOWED_EXTENSIONS_FASTA = [".fasta", ".fa", ".fna", ".faa"];

const ALLOWED_EXTENSIONS_GFF = [".gff", ".gff3", ".gtf"];

// const ALLOWED_EXTENSIONS_FASTA = [
//   '.fastq', '.vcf', '.gbk'
// ]

const storageFastas = multer.diskStorage({
  destination: (req, file, cb) => {
    const rootPath = path.resolve(process.cwd(), "src/uploads/fastas");
    cb(null, rootPath);
  },
  filename: (req, file, cb) => {
    // 1. Get the original name without the extension
    const originalName = path.parse(file.originalname).name;
    const ext = path.parse(file.originalname).ext;

    // 2. Clean the filename: 
    // - Replace spaces with underscores
    // - Remove any character that isn't a word, digit, dash, or underscore
    const cleanName = originalName
      .replace(/\s+/g, "_") 
      .replace(/[^\w-]/g, "");

    // 3. Add a timestamp suffix for uniqueness (prevents overwriting files with same name)
    const suffix = Date.now() + "-" + Math.round(Math.random() * 1e4);
    
    const newFileName = `${cleanName}_${suffix}${ext}`;
    
    cb(null, newFileName);
  },
});

const storageGffs = multer.diskStorage({
  destination: "../uploads/gffs",
}); // We use memoryStorage for direct parsing

export const uploadFasta = multer({
  storage: storageFastas,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit to 10MB for safety
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_EXTENSIONS_FASTA.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${ext}. Helix accepts for fasta files only .fasta, .fa, .fna, .faa`
        )
      );
    }
  },
});

export const uploadGff = multer({
  storage: storageGffs,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit to 10MB for safety
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_EXTENSIONS_GFF.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${ext}. Helix accepts for gff files only .gff, .gff3, .gtf`
        )
      );
    }
  },
});
