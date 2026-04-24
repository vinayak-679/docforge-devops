const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

// Load JSON data
const data = JSON.parse(fs.readFileSync("data.json", "utf-8"));

// Load template
const content = fs.readFileSync("template_clean.docx", "binary");

// Utility: random picker
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Ensure output folder exists
if (!fs.existsSync("output")) {
  fs.mkdirSync("output");
}

// Track unique combinations
const generatedSet = new Set();

// Generate logically valid data
function generateValidData() {
  let docData;
  let key;

  do {
    docData = {
      agreement_date: getRandom(data.agreement_date),

      consultant_name: getRandom(data.consultant_name),
      consultant_parent: getRandom(data.consultant_parent),
      consultant_age: getRandom(data.consultant_age),
      consultant_address: getRandom(data.consultant_address),

      company_name: getRandom(data.company_name),
      company_address: getRandom(data.company_address),
      country: getRandom(data.country),

      business_type: getRandom(data.business_type),
      service_domain: getRandom(data.service_domain),
      service_description: getRandom(data.service_description),

      contract_duration: getRandom(data.contract_duration),

      payment_clause: getRandom(data.payment_clause),
      termination_clause: getRandom(data.termination_clause),
      non_exclusivity_clause: getRandom(data.non_exclusivity_clause),

      jurisdiction: getRandom(data.jurisdiction),
      court_location: getRandom(data.court_location),

      company_signatory: getRandom(data.company_signatory),
      designation: getRandom(data.designation)
    };

    // ---------------------------
    // 🔧 LOGIC RULES
    // ---------------------------

    // Rule 1: Align court location with company address
    if (docData.company_address.includes("Bangalore")) {
      docData.court_location = "Bangalore";
    } else if (docData.company_address.includes("Mumbai")) {
      docData.court_location = "Mumbai";
    } else if (docData.company_address.includes("Nagpur")) {
      docData.court_location = "Nagpur";
    }

    // Rule 2: Match business type with service domain
    if (docData.business_type === "IT software services") {
      docData.service_domain = "technology consulting";
      docData.service_description = "technical consulting and system design services";
    }

    if (docData.business_type === "manufacturing of paper bags") {
      docData.service_domain = "business strategy";
      docData.service_description = "advisory, mentorship and strategic consulting services";
    }

    if (docData.business_type === "logistics and supply chain") {
      docData.service_domain = "operations optimization";
      docData.service_description = "business growth and operational advisory services";
    }

    // Unique key
    key = JSON.stringify(docData);

  } 
  while (generatedSet.has(key)); // avoid duplicates

  generatedSet.add(key);
  return docData;
}

// Generate documents
function generateDocs(count) {
  for (let i = 1; i <= count; i++) {
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
  delimiters: {
    start: "{{",
    end: "}}"
  }
});

    const docData = generateValidData();

    // doc.setData(docData);

    try {
      doc.render(docData);
    } catch (error) {
      console.error(`❌ Error in document ${i}:`, error);
      continue;
    }

    const buffer = doc.getZip().generate({ type: "nodebuffer" });

    const filePath = path.join("output", `document_${i}.docx`);
    fs.writeFileSync(filePath, buffer);
  }

  console.log(`✅ ${count} UNIQUE documents generated successfully!`);
}

// 🔥 RUN FOR 20 DOCUMENTS
generateDocs(20);