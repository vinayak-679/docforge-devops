// ─────────────────────────────────────────────
// DocForge — Frontend Application Logic
// ─────────────────────────────────────────────

(function () {
  "use strict";

  // ─── DOM Elements ───
  const $ = (sel) => document.querySelector(sel);
  const templateDropzone = $("#template-dropzone");
  const templateInput = $("#template-input");
  const templateFilename = $("#template-filename");
  const templateNameText = $("#template-name-text");
  const jsonInput = $("#json-input");
  const jsonStatus = $("#json-status");
  const jsonUploadBtn = $("#json-upload-btn");
  const jsonFileInput = $("#json-file-input");
  const docCount = $("#doc-count");
  const outputFormat = $("#output-format");
  const pdfOption = $("#pdf-option");
  const rulesToggle = $("#rules-toggle");
  const rulesEditor = $("#rules-editor");
  const rulesList = $("#rules-list");
  const addRuleBtn = $("#add-rule-btn");
  const previewBtn = $("#preview-btn");
  const generateBtn = $("#generate-btn");
  const previewModal = $("#preview-modal");
  const modalClose = $("#modal-close");
  const previewContent = $("#preview-content");
  const progressOverlay = $("#progress-overlay");
  const progressText = $("#progress-text");
  const progressFill = $("#progress-fill");
  const toastContainer = $("#toast-container");

  // ─── State ───
  let templateFile = null;
  let parsedJson = null;
  let jsonFields = [];
  let pdfAvailable = false;

  // ─── Init ───
  init();

  function init() {
    checkPdfSupport();
    bindEvents();
    validateState();
  }

  // ─── PDF Support Check ───
  async function checkPdfSupport() {
    try {
      const res = await fetch("/api/check-pdf");
      const data = await res.json();
      pdfAvailable = data.available;
      if (!pdfAvailable) {
        pdfOption.textContent = "PDF (unavailable — install LibreOffice)";
        pdfOption.disabled = true;
      }
    } catch {
      pdfOption.disabled = true;
    }
  }

  // ─── Event Bindings ───
  function bindEvents() {
    // Template drag & drop
    templateDropzone.addEventListener("click", () => templateInput.click());
    templateDropzone.addEventListener("dragover", handleDragOver);
    templateDropzone.addEventListener("dragleave", handleDragLeave);
    templateDropzone.addEventListener("drop", handleTemplateDrop);
    templateInput.addEventListener("change", handleTemplateSelect);

    // JSON editor
    jsonInput.addEventListener("input", debounce(validateJson, 300));
    jsonUploadBtn.addEventListener("click", () => jsonFileInput.click());
    jsonFileInput.addEventListener("change", handleJsonFileUpload);

    // Rules toggle
    rulesToggle.addEventListener("change", () => {
      rulesEditor.classList.toggle("open", rulesToggle.checked);
    });

    // Add rule
    addRuleBtn.addEventListener("click", addRuleRow);

    // Actions
    previewBtn.addEventListener("click", handlePreview);
    generateBtn.addEventListener("click", handleGenerate);

    // Modal
    modalClose.addEventListener("click", closeModal);
    previewModal.addEventListener("click", (e) => {
      if (e.target === previewModal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // ─── Template Handling ───
  function handleDragOver(e) {
    e.preventDefault();
    templateDropzone.classList.add("drag-over");
  }

  function handleDragLeave(e) {
    e.preventDefault();
    templateDropzone.classList.remove("drag-over");
  }

  function handleTemplateDrop(e) {
    e.preventDefault();
    templateDropzone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) setTemplateFile(file);
  }

  function handleTemplateSelect(e) {
    const file = e.target.files[0];
    if (file) setTemplateFile(file);
  }

  function setTemplateFile(file) {
    if (!file.name.endsWith(".docx")) {
      showToast("Please upload a .docx file", "error");
      return;
    }
    templateFile = file;
    templateNameText.textContent = file.name;
    templateFilename.classList.add("visible");
    showToast(`Template loaded: ${file.name}`, "success");
    validateState();
  }

  // ─── JSON Handling ───
  function validateJson() {
    const text = jsonInput.value.trim();
    if (!text) {
      jsonStatus.textContent = "";
      jsonStatus.className = "json-status";
      jsonInput.classList.remove("valid", "invalid");
      parsedJson = null;
      jsonFields = [];
      validateState();
      return;
    }

    try {
      const data = JSON.parse(text);
      // Validate structure: all values should be arrays
      const keys = Object.keys(data);
      const allArrays = keys.every((k) => Array.isArray(data[k]));

      if (!allArrays) {
        throw new Error("All values must be arrays");
      }

      if (keys.length === 0) {
        throw new Error("JSON must have at least one field");
      }

      parsedJson = data;
      jsonFields = keys;
      jsonStatus.textContent = `✓ ${keys.length} fields`;
      jsonStatus.className = "json-status valid";
      jsonInput.classList.remove("invalid");
      jsonInput.classList.add("valid");

      // Update rule dropdowns
      updateRuleDropdowns();
    } catch (err) {
      parsedJson = null;
      jsonFields = [];
      jsonStatus.textContent = `✗ ${err.message}`;
      jsonStatus.className = "json-status invalid";
      jsonInput.classList.remove("valid");
      jsonInput.classList.add("invalid");
    }

    validateState();
  }

  function handleJsonFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      jsonInput.value = ev.target.result;
      validateJson();
      showToast(`JSON loaded: ${file.name}`, "success");
    };
    reader.readAsText(file);
  }

  // ─── Validation ───
  function validateState() {
    const ready = templateFile !== null && parsedJson !== null;
    previewBtn.disabled = !ready;
    generateBtn.disabled = !ready;
  }

  // ─── Rules ───
  let ruleCounter = 0;

  function addRuleRow() {
    ruleCounter++;
    const id = ruleCounter;
    const row = document.createElement("div");
    row.className = "rule-row";
    row.id = `rule-${id}`;
    row.innerHTML = `
      <select class="form-select rule-cond-field" data-rule="${id}">
        ${fieldOptions()}
      </select>
      <span class="rule-label">where</span>
      <select class="form-select rule-operator" data-rule="${id}">
        <option value="contains">contains</option>
        <option value="equals">equals</option>
        <option value="startsWith">starts with</option>
        <option value="endsWith">ends with</option>
      </select>
      <input class="form-input rule-cond-value" data-rule="${id}" placeholder="value">
      <span class="rule-label">→ set</span>
      <select class="form-select rule-action-field" data-rule="${id}">
        ${fieldOptions()}
      </select>
      <input class="form-input rule-action-value" data-rule="${id}" placeholder="to value">
      <button class="rule-remove" onclick="document.getElementById('rule-${id}').remove()">✕</button>
    `;
    rulesList.appendChild(row);
  }

  function fieldOptions() {
    if (jsonFields.length === 0) {
      return '<option value="">— upload JSON first —</option>';
    }
    return jsonFields.map((f) => `<option value="${f}">${f}</option>`).join("");
  }

  function updateRuleDropdowns() {
    const opts = fieldOptions();
    document.querySelectorAll(".rule-cond-field, .rule-action-field").forEach((sel) => {
      const current = sel.value;
      sel.innerHTML = opts;
      if (jsonFields.includes(current)) sel.value = current;
    });
  }

  function collectRules() {
    const rules = [];
    document.querySelectorAll(".rule-row").forEach((row) => {
      const condField = row.querySelector(".rule-cond-field")?.value;
      const operator = row.querySelector(".rule-operator")?.value;
      const condValue = row.querySelector(".rule-cond-value")?.value;
      const actionField = row.querySelector(".rule-action-field")?.value;
      const actionValue = row.querySelector(".rule-action-value")?.value;

      if (condField && operator && condValue && actionField && actionValue) {
        rules.push({
          condition: { field: condField, operator, value: condValue },
          actions: [{ field: actionField, value: actionValue }],
        });
      }
    });
    return rules;
  }

  // ─── Preview ───
  async function handlePreview() {
    if (!templateFile || !parsedJson) return;

    showProgress("Generating preview...");

    try {
      const formData = buildFormData();
      const res = await fetch("/api/preview", { method: "POST", body: formData });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Preview failed");
      }

      const data = await res.json();
      previewContent.innerHTML = data.html || "<p>No content</p>";
      hideProgress();
      openModal();
    } catch (err) {
      hideProgress();
      showToast(err.message, "error");
    }
  }

  // ─── Generate ───
  async function handleGenerate() {
    if (!templateFile || !parsedJson) return;

    const count = parseInt(docCount.value, 10) || 1;
    const format = outputFormat.value;

    showProgress(`Generating ${count} ${format.toUpperCase()} documents...`);
    progressFill.style.width = "30%";

    try {
      const formData = buildFormData();
      formData.append("count", count);
      formData.append("format", format);

      progressFill.style.width = "60%";

      const res = await fetch("/api/generate", { method: "POST", body: formData });

      if (!res.ok) {
        let errMsg = "Generation failed";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          // response might not be json if it's a zip error
        }
        throw new Error(errMsg);
      }

      progressFill.style.width = "90%";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated_documents.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      progressFill.style.width = "100%";

      setTimeout(() => {
        hideProgress();
        showToast(`✅ ${count} documents generated and downloaded!`, "success");
      }, 500);
    } catch (err) {
      hideProgress();
      showToast(err.message, "error");
    }
  }

  // ─── Helpers ───
  function buildFormData() {
    const formData = new FormData();
    formData.append("template", templateFile);
    formData.append("testData", JSON.stringify(parsedJson));

    if (rulesToggle.checked) {
      const rules = collectRules();
      if (rules.length > 0) {
        formData.append("rules", JSON.stringify(rules));
      }
    }

    return formData;
  }

  function openModal() {
    previewModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    previewModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  function showProgress(text) {
    progressText.textContent = text;
    progressFill.style.width = "10%";
    progressOverlay.classList.add("active");
  }

  function hideProgress() {
    progressOverlay.classList.remove("active");
    progressFill.style.width = "0%";
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    const icons = { success: "✅", error: "❌", warning: "⚠️" };
    toast.innerHTML = `<span>${icons[type] || ""}</span> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(30px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }
})();
