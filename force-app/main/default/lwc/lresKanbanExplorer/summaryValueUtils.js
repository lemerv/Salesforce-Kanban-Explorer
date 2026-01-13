export function coerceNumericValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }
  const cleaned = String(rawValue).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function coerceSummaryValue(record, summary, extractFieldData) {
  if (
    !record ||
    !summary?.fieldApiName ||
    typeof extractFieldData !== "function"
  ) {
    return null;
  }
  const data = extractFieldData(record, summary.fieldApiName);
  return coerceNumericValue(data?.raw ?? null);
}

export function resolveCurrencyCode(
  record,
  extractFieldData,
  currencyFieldApiName,
  fallbackCurrencyCode
) {
  const isValidCurrencyCode = (value) => {
    if (!value) {
      return false;
    }
    const normalized = String(value).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : false;
  };

  if (typeof extractFieldData === "function" && currencyFieldApiName) {
    const data = extractFieldData(record, currencyFieldApiName);
    const candidate = data?.raw ?? data?.display ?? null;
    return (
      isValidCurrencyCode(candidate) ||
      isValidCurrencyCode(fallbackCurrencyCode) ||
      null
    );
  }
  const field = record?.fields?.CurrencyIsoCode;
  if (!field) {
    return isValidCurrencyCode(fallbackCurrencyCode) || null;
  }
  return (
    isValidCurrencyCode(field.value) ||
    isValidCurrencyCode(field.displayValue) ||
    isValidCurrencyCode(fallbackCurrencyCode) ||
    null
  );
}

export function formatSummaryValue(summary, value, options = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  let normalizedValue = value;
  const scale =
    typeof summary?.scale === "number" && summary.scale >= 0
      ? summary.scale
      : undefined;
  const formatterOptions = {};
  if (scale !== undefined) {
    formatterOptions.minimumFractionDigits = scale;
    formatterOptions.maximumFractionDigits = scale;
  }
  if (summary?.dataType === "percent") {
    formatterOptions.style = "percent";
    normalizedValue =
      Math.abs(normalizedValue) > 1 ? normalizedValue / 100 : normalizedValue;
  } else if (summary?.dataType === "currency" && options.currencyCode) {
    formatterOptions.style = "currency";
    formatterOptions.currency = options.currencyCode;
  }
  return new Intl.NumberFormat(undefined, formatterOptions).format(
    normalizedValue
  );
}
