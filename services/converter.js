const { execSync } = require("child_process");
const libre = require("libreoffice-convert");
const util = require("util");

const convertAsync = util.promisify(libre.convert);

/**
 * Check if LibreOffice is installed on the system.
 * @returns {boolean}
 */
function isPdfAvailable() {
  try {
    execSync("libreoffice --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a DOCX buffer to PDF buffer using LibreOffice.
 * @param {Buffer} docxBuffer - The DOCX file as a buffer
 * @returns {Promise<Buffer>} The PDF file as a buffer
 */
async function convertToPdf(docxBuffer) {
  if (!isPdfAvailable()) {
    throw new Error(
      "LibreOffice is not installed. PDF conversion is unavailable. Install with: sudo apt install libreoffice"
    );
  }

  try {
    const pdfBuffer = await convertAsync(docxBuffer, ".pdf", undefined);
    return pdfBuffer;
  } catch (error) {
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

module.exports = {
  isPdfAvailable,
  convertToPdf,
};
