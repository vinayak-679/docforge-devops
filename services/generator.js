const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

/**
 * Extract all {{placeholder}} names from a DOCX template.
 * @param {Buffer} templateBuffer - The .docx file as a buffer
 * @returns {string[]} Array of placeholder names found in the template
 */
function extractPlaceholders(templateBuffer) {
  const zip = new PizZip(templateBuffer);
  const placeholders = new Set();

  // Search through all XML files in the docx archive
  const files = Object.keys(zip.files);
  for (const fileName of files) {
    if (fileName.endsWith(".xml") || fileName.endsWith(".xml.rels")) {
      const content = zip.file(fileName)?.asText();
      if (content) {
        // Match {{placeholder}} patterns — handle XML tags that may split the placeholder
        // First, strip XML tags to get raw text, then find placeholders
        const rawText = content.replace(/<[^>]+>/g, "");
        const matches = rawText.matchAll(/\{\{([^}]+)\}\}/g);
        for (const match of matches) {
          placeholders.add(match[1].trim());
        }
      }
    }
  }

  return Array.from(placeholders);
}

/**
 * Pick a random element from an array.
 * @param {any[]} arr
 * @returns {any}
 */
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Apply logic rules to a data object.
 * Rules format:
 * {
 *   condition: { field: "company_address", operator: "contains", value: "Bangalore" },
 *   actions: [{ field: "court_location", value: "Bangalore" }]
 * }
 *
 * Supported operators: contains, equals, startsWith, endsWith
 *
 * @param {Object} docData - The document data object
 * @param {Array} rules - Array of rule objects
 * @returns {Object} Modified document data
 */
function applyRules(docData, rules) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return docData;
  }

  for (const rule of rules) {
    const { condition, actions } = rule;
    if (!condition || !actions) continue;

    const fieldValue = String(docData[condition.field] || "");
    const conditionValue = String(condition.value || "");
    let matches = false;

    switch (condition.operator) {
      case "contains":
        matches = fieldValue.includes(conditionValue);
        break;
      case "equals":
        matches = fieldValue === conditionValue;
        break;
      case "startsWith":
        matches = fieldValue.startsWith(conditionValue);
        break;
      case "endsWith":
        matches = fieldValue.endsWith(conditionValue);
        break;
      default:
        matches = false;
    }

    if (matches) {
      for (const action of actions) {
        if (action.field && action.value !== undefined) {
          docData[action.field] = action.value;
        }
      }
    }
  }

  return docData;
}

/**
 * Generate N unique data combinations from test data.
 * @param {Object} testData - Object with field names as keys and arrays of values
 * @param {number} count - Number of unique combinations to generate
 * @param {Array} rules - Optional logic rules
 * @returns {Object[]} Array of unique data objects
 */
function generateUniqueDataSets(testData, count, rules) {
  const generatedSet = new Set();
  const results = [];

  // Calculate maximum possible combinations
  const fields = Object.keys(testData);
  let maxCombinations = 1;
  for (const field of fields) {
    if (Array.isArray(testData[field]) && testData[field].length > 0) {
      maxCombinations *= testData[field].length;
    }
  }

  // Cap the count at max possible unique combinations
  const effectiveCount = Math.min(count, maxCombinations);

  // Safety: max attempts to avoid infinite loop
  const maxAttempts = effectiveCount * 100;
  let attempts = 0;

  while (results.length < effectiveCount && attempts < maxAttempts) {
    attempts++;

    // Build a random data object
    const docData = {};
    for (const field of fields) {
      if (Array.isArray(testData[field]) && testData[field].length > 0) {
        docData[field] = getRandom(testData[field]);
      } else {
        docData[field] = testData[field];
      }
    }

    // Apply logic rules if provided
    applyRules(docData, rules);

    // Check uniqueness
    const key = JSON.stringify(docData);
    if (!generatedSet.has(key)) {
      generatedSet.add(key);
      results.push(docData);
    }
  }

  if (results.length < count) {
    console.warn(
      `⚠️ Could only generate ${results.length} unique combinations out of ${count} requested (max possible: ${maxCombinations})`
    );
  }

  return results;
}

/**
 * Render a single document from template and data.
 * @param {Buffer} templateBuffer - The .docx template as a buffer
 * @param {Object} data - Data to fill into the template
 * @returns {Buffer} The rendered .docx as a buffer
 */
function renderDocument(templateBuffer, data) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    delimiters: {
      start: "{{",
      end: "}}",
    },
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  return doc.getZip().generate({ type: "nodebuffer" });
}

/**
 * Generate multiple documents from a template and test data.
 * @param {Buffer} templateBuffer - The .docx template as a buffer
 * @param {Object} testData - Test data with arrays of values
 * @param {number} count - Number of documents to generate
 * @param {Array} rules - Optional logic rules
 * @returns {{ buffers: Buffer[], dataSets: Object[], actualCount: number }}
 */
function generateDocuments(templateBuffer, testData, count, rules) {
  const dataSets = generateUniqueDataSets(testData, count, rules);
  const buffers = [];

  for (const data of dataSets) {
    try {
      const buffer = renderDocument(templateBuffer, data);
      buffers.push(buffer);
    } catch (error) {
      console.error("Error rendering document:", error.message);
    }
  }

  return {
    buffers,
    dataSets,
    actualCount: buffers.length,
  };
}

module.exports = {
  extractPlaceholders,
  generateDocuments,
  generateUniqueDataSets,
  renderDocument,
  applyRules,
};
