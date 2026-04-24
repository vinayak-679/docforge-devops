const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const mammoth = require("mammoth");

const { generateDocuments, extractPlaceholders } = require("./services/generator");
const { isPdfAvailable, convertToPdf } = require("./services/converter");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.endsWith(".docx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx files are allowed"), false);
    }
  },
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

/**
 * GET /api/check-pdf
 * Check if LibreOffice is available for PDF export
 */
app.get("/api/check-pdf", (req, res) => {
  res.json({ available: isPdfAvailable() });
});

/**
 * POST /api/preview
 * Generate a single document and return HTML preview
 */
app.post("/api/preview", upload.single("template"), async (req, res) => {
  try {
    const templateBuffer = req.file?.buffer;
    if (!templateBuffer) {
      return res.status(400).json({ error: "Template file is required" });
    }

    let testData;
    try {
      testData = JSON.parse(req.body.testData);
    } catch {
      return res.status(400).json({ error: "Invalid JSON test data" });
    }

    let rules = [];
    if (req.body.rules) {
      try {
        rules = JSON.parse(req.body.rules);
      } catch {
        rules = [];
      }
    }

    // Extract placeholders for info
    const placeholders = extractPlaceholders(templateBuffer);

    // Generate 1 document
    const result = generateDocuments(templateBuffer, testData, 1, rules);

    if (result.buffers.length === 0) {
      return res.status(500).json({ error: "Failed to generate preview document" });
    }

    // Convert DOCX buffer to HTML using mammoth
    const mammothResult = await mammoth.convertToHtml({ buffer: result.buffers[0] });

    res.json({
      html: mammothResult.value,
      placeholders,
      dataUsed: result.dataSets[0],
      warnings: mammothResult.messages,
    });
  } catch (error) {
    console.error("Preview error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/generate
 * Generate multiple documents and return as ZIP
 */
app.post("/api/generate", upload.single("template"), async (req, res) => {
  try {
    const templateBuffer = req.file?.buffer;
    if (!templateBuffer) {
      return res.status(400).json({ error: "Template file is required" });
    }

    let testData;
    try {
      testData = JSON.parse(req.body.testData);
    } catch {
      return res.status(400).json({ error: "Invalid JSON test data" });
    }

    const count = parseInt(req.body.count, 10) || 1;
    const format = req.body.format || "docx";

    let rules = [];
    if (req.body.rules) {
      try {
        rules = JSON.parse(req.body.rules);
      } catch {
        rules = [];
      }
    }

    // Generate documents
    console.log(`📄 Generating ${count} documents in ${format} format...`);
    const result = generateDocuments(templateBuffer, testData, count, rules);

    if (result.buffers.length === 0) {
      return res.status(500).json({ error: "Failed to generate any documents" });
    }

    // Convert to PDF if requested
    let finalBuffers = result.buffers;
    let fileExtension = "docx";

    if (format === "pdf") {
      if (!isPdfAvailable()) {
        return res.status(400).json({
          error:
            "PDF conversion is not available. LibreOffice is not installed on the server.",
        });
      }

      console.log("🔄 Converting to PDF...");
      finalBuffers = [];
      for (let i = 0; i < result.buffers.length; i++) {
        try {
          const pdfBuffer = await convertToPdf(result.buffers[i]);
          finalBuffers.push(pdfBuffer);
          console.log(`  ✅ Converted document ${i + 1}/${result.buffers.length}`);
        } catch (error) {
          console.error(`  ❌ Failed to convert document ${i + 1}:`, error.message);
        }
      }
      fileExtension = "pdf";
    }

    // Create ZIP archive
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="generated_documents.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.pipe(res);

    for (let i = 0; i < finalBuffers.length; i++) {
      archive.append(finalBuffers[i], {
        name: `document_${i + 1}.${fileExtension}`,
      });
    }

    archive.finalize();

    console.log(
      `✅ Generated ${finalBuffers.length} ${fileExtension.toUpperCase()} documents`
    );
  } catch (error) {
    console.error("Generation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * POST /api/placeholders
 * Extract placeholders from a template
 */
app.post("/api/placeholders", upload.single("template"), (req, res) => {
  try {
    const templateBuffer = req.file?.buffer;
    if (!templateBuffer) {
      return res.status(400).json({ error: "Template file is required" });
    }

    const placeholders = extractPlaceholders(templateBuffer);
    res.json({ placeholders });
  } catch (error) {
    console.error("Placeholder extraction error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend for all non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 20MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message });
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Document Generator running at http://localhost:${PORT}`);
  console.log(`📄 PDF support: ${isPdfAvailable() ? "✅ Available" : "❌ Not available (install LibreOffice)"}\n`);
});
