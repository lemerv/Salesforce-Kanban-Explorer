- [Shared Utilities Guide](#shared-utilities-guide)
  - [LRES_FieldValidationUtil.cls](#lres_fieldvalidationutilcls)
  - [lresDateTimeUtils.js](#lresdatetimeutilsjs)
  - [lresErrorHandler.js](#lreserrorhandlerjs)
  - [lresFieldDisplayUtils.js](#lresfielddisplayutilsjs)
  - [lresFieldUtils.js](#lresfieldutilsjs)
  - [lresOutputUtils.js](#lresoutpututilsjs)
  - [lresTestUtils.js](#lrestestutilsjs)

---

# Shared Utilities Guide

## LRES_FieldValidationUtil.cls
- **What it does**: Apex helper for cleaning and validating SOQL field references, WHERE/ORDER BY clauses, and field-level security. Also provides utilities for extracting field values/labels from SObjects.
- **Inputs**:
  - Raw clause strings (`rawWhere`, `rawOrderBy`) and message prefixes for sanitization.
  - Object and field identifiers (`objectApiName`, `fieldPath`, `baseName`) for validation and label resolution.
  - SObjects and Describe results for value extraction and FLS checks.
  - Field lists (strings or arrays) to normalize or parse.
- **Outputs**:
  - Sanitized clause strings or `null` when empty/invalid input.
  - `OrderByMessages` with prebuilt error-prefix text.
  - `FlsValidationResult` describing accessible fields and any removed SELECT/ORDER BY/WHERE paths.
  - Parsed field path lists and validated/normalized field paths.
  - Extracted field values and best-effort labels for relationship paths.

## lresDateTimeUtils.js
- **What it does**: Formats Date/DateTime values using custom pattern tokens with locale/time zone awareness. Safely parses date-only strings and returns formatted output tailored to patterns.
- **Inputs**:
  - Date, ISO string, or timestamp plus formatting options (`dateOnly`, `pattern`, optional token cache, locale, timeZone).
  - Pattern strings composed of tokens (e.g., `yyyy`, `MM`, `dd`, `HH`, `mm`, `a`) and quoted literals.
- **Outputs**:
  - Structured date parts object with numeric, textual, and time zone fragments.
  - Formatted string per pattern or `null` when the value/pattern cannot be parsed.
  - Helper constants for pattern parsing (`CONNECTOR_LITERAL_PATTERN`, `TIME_TOKEN_CHARS`).
- **Used by**: `lresFieldDisplayUtils.js`

## lresErrorHandler.js
- **What it does**: Normalizes Salesforce errors (wire, imperative, Apex, or generic) into a consistent payload and optionally dispatches Lightning toasts.
- **Inputs**:
  - Raw error objects/strings from network, Apex, or UI handlers.
  - Optional toast overrides (`title`, `message`, `variant`, `mode`) and a component instance for dispatch.
- **Outputs**:
  - Parsed error shape `{ title, message, messages[] }` deduplicated and flattened from field/page/output errors.
  - Dispatched `ShowToastEvent` when using `showErrorToast`.
- **Depends on**: `lresFieldUtils.js`

## lresFieldDisplayUtils.js
- **What it does**: Utilities for qualifying field API names, resolving display labels, pulling field values from wire records, and formatting values (including date/time) for presentation.
- **Inputs**:
  - Component metadata/context (`cardObjectApiName`, `objectInfo`, picklist values, owner field names).
  - Wire record payloads with `fields` maps and optional parent label maps.
  - Field paths, icon/emoji strings, date/time pattern options, and optional sort/grouping defaults.
- **Outputs**:
  - Qualified field paths, candidate field lookup lists, and simple field names.
  - Display-friendly values/placeholders with sanitized output and optional date/time formatting.
  - Resolved labels for fields and relationships, effective sort fields, metadata column definitions, owner/parent labels, and normalized icon names or emoji characters.
- **Depends on**: `lresFieldUtils.js`, `lresDateTimeUtils.js`, `lresOutputUtils.js`

## lresFieldUtils.js
- **What it does**: Lightweight helpers for normalizing primitive inputs and presenting API names as human-friendly labels.
- **Inputs**:
  - Strings or mixed values to normalize (`normalizeString`, `normalizePositiveInteger`, `normalizeBoolean`).
  - API names for fields/objects (including qualified or custom suffix variants).
- **Outputs**:
  - Cleaned primitives (trimmed strings, parsed positive integers, booleans).
  - Readable labels derived from API names (`formatApiName`, `formatObjectLabel`).
- **Used by**: `lresFieldDisplayUtils.js`, `lresErrorHandler.js`

## lresOutputUtils.js
- **What it does**: Sanitizes display strings by decoding HTML entities, converting `<br>` tags to line breaks, and normalizing newline characters.
- **Inputs**:
  - Raw field/output values (string or other types).
- **Outputs**:
  - Sanitized strings with decoded entities and normalized line breaks, or the original non-string value when untouched.
- **Used by**: `lresFieldDisplayUtils.js`

## lresTestUtils.js
- **What it does**: Test helpers for Lightning unit tests, covering promise flushing, component settling, DataTransfer mocks, and wire record builders.
- **Inputs**:
  - Optional iteration count for settling asynchronous DOM updates.
  - Data for simulating drag/drop payloads and raw record fixtures (ids, field maps, optional object API name).
- **Outputs**:
  - Promises that flush microtasks (`flushPromises`, `settleComponent`).
  - Mocked `DataTransfer` object with spy-able `setData`/`getData`.
  - Wire-record-shaped objects and field maps keyed by both qualified and simple field names.
