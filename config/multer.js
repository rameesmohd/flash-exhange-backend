const multer = require('multer');
require('dotenv').config();

// 🔹 Configure Multer Storage (Save in "uploads" Folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // 🔹 Save files in "uploads" directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // 🔹 Rename files
  },
});

// 🔹 File Filter (Accept Only Images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg, .jpg, .png files are allowed"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;