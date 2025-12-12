import { api, wire } from "lwc";
import LightningModal from "lightning/modal";
import { getRecord } from "lightning/uiRecordApi";

const DEBUG_PREFIX = "[KanbanRecordModal]";

export default class KanbanRecordModal extends LightningModal {
  @api recordId;
  @api objectApiName;
  @api headerFieldApiName;
  @api debugLogging = false;

  formMode = "view";
  errorMessage = "";
  isSaving = false;
  headerRecord;

  logDebug(message, detail) {
    if (!this.debugLogging) {
      return;
    }
    try {
      // eslint-disable-next-line no-console
      console.debug(DEBUG_PREFIX, message, detail);
    } catch {
      // Swallow logging errors in production environments.
    }
  }

  logError(message, detail) {
    if (!this.debugLogging) {
      return;
    }
    try {
      // eslint-disable-next-line no-console
      console.error(DEBUG_PREFIX, message, detail);
    } catch {
      // Swallow logging errors in production environments.
    }
  }

  @wire(getRecord, { recordId: "$recordId", fields: "$headerFields" })
  wiredHeaderRecord(value) {
    this.headerRecord = value;
  }

  get headerTitle() {
    const value = this.getHeaderFieldValue();
    if (value) {
      return value;
    }
    if (this.objectApiName) {
      return `${this.objectApiName} Record`;
    }
    return "Record";
  }

  getHeaderFieldValue() {
    const record = this.headerRecord?.data;
    const fieldPath = this.headerFieldApiName;
    if (!record || !fieldPath) {
      return null;
    }
    return this.extractFieldValue(record, fieldPath) || null;
  }

  extractFieldValue(record, fieldPath) {
    const normalizedPath = this.normalizeFieldPath(fieldPath);
    if (!normalizedPath) {
      return null;
    }
    const parts = normalizedPath.split(".");
    let currentFields = record?.fields;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const fieldData = currentFields?.[part];
      if (!fieldData) {
        return null;
      }
      const isLast = index === parts.length - 1;
      if (isLast) {
        return fieldData.displayValue ?? fieldData.value ?? null;
      }
      currentFields = fieldData.value?.fields;
    }
    return null;
  }

  normalizeFieldPath(fieldPath) {
    if (!fieldPath) {
      return null;
    }
    const segments = fieldPath.split(".").filter(Boolean);
    if (!segments.length) {
      return null;
    }
    const [first, ...rest] = segments;
    const objectName = (this.objectApiName || "").toLowerCase();
    if (first.toLowerCase() === objectName && rest.length) {
      return rest.join(".");
    }
    return segments.join(".");
  }

  get headerFields() {
    if (!this.recordId || !this.headerFieldApiName) {
      return [];
    }
    return [this.headerFieldApiName];
  }

  get isEditDisabled() {
    return this.formMode === "edit";
  }

  handleEdit() {
    this.formMode = "edit";
    this.errorMessage = "";
    this.logDebug("Switched to edit mode.", { recordId: this.recordId });
  }

  handleCancelEdit(event) {
    event?.preventDefault?.();
    this.formMode = "view";
    this.errorMessage = "";
    this.isSaving = false;
    this.logDebug("Edit cancelled; returning to view.", {
      recordId: this.recordId
    });
  }

  handleCloseClick() {
    this.logDebug("Modal closed without save.", { recordId: this.recordId });
    this.close({ recordId: this.recordId, saved: false });
  }

  handleSubmit() {
    this.errorMessage = "";
    this.isSaving = true;
    this.logDebug("Submitting record edit.", { recordId: this.recordId });
  }

  handleSuccess(event) {
    this.isSaving = false;
    this.errorMessage = "";
    this.logDebug("Record saved successfully.", {
      recordId: this.recordId,
      fields: event?.detail?.fields
    });
    this.close({ recordId: this.recordId, saved: true });
  }

  handleError(event) {
    this.isSaving = false;
    const message =
      event?.detail?.message ||
      event?.detail?.detail ||
      "Unable to save record.";
    this.errorMessage = message;
    this.logError("Record save failed.", {
      recordId: this.recordId,
      message,
      error: event?.detail
    });
  }
}
