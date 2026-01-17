import {
  coerceNumericValue,
  coerceBooleanValue,
  coerceSummaryValue
} from "../summaryValueUtils";

describe("summaryValueUtils.coerceNumericValue", () => {
  it("parses numbers from formatted strings", () => {
    expect(coerceNumericValue("$1,200.50")).toBe(1200.5);
    expect(coerceNumericValue("1,000")).toBe(1000);
  });

  it("returns null for invalid or empty values", () => {
    expect(coerceNumericValue("abc")).toBeNull();
    expect(coerceNumericValue("")).toBeNull();
    expect(coerceNumericValue(null)).toBeNull();
  });
});

describe("summaryValueUtils.coerceBooleanValue", () => {
  it("coerces true/false strings", () => {
    expect(coerceBooleanValue(" true ")).toBe(true);
    expect(coerceBooleanValue("FALSE")).toBe(false);
  });

  it("returns null for unsupported values", () => {
    expect(coerceBooleanValue("yes")).toBeNull();
    expect(coerceBooleanValue("")).toBeNull();
    expect(coerceBooleanValue(null)).toBeNull();
  });
});

describe("summaryValueUtils.coerceSummaryValue", () => {
  const extractFieldData = (record, field) => ({
    raw: record[field],
    display: record[field]
  });

  it("coerces boolean summaries", () => {
    const record = { Flag: "true" };
    const summary = { fieldApiName: "Flag", dataType: "boolean" };
    expect(coerceSummaryValue(record, summary, extractFieldData)).toBe(true);
  });

  it("coerces numeric summaries", () => {
    const record = { Amount: "$2,500" };
    const summary = { fieldApiName: "Amount", dataType: "currency" };
    expect(coerceSummaryValue(record, summary, extractFieldData)).toBe(2500);
  });

  it("returns raw values for date summaries", () => {
    const record = { CloseDate: "2024-01-10" };
    const summary = { fieldApiName: "CloseDate", dataType: "date" };
    expect(coerceSummaryValue(record, summary, extractFieldData)).toBe(
      "2024-01-10"
    );
  });
});
