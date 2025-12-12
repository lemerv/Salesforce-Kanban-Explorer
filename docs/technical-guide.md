- [1. Overview](#1-overview)
- [2. Operation Modes](#2-operation-modes)
- [3. Architecture Overview](#3-architecture-overview)
- [4. Mode-Specific Flow Diagrams](#4-mode-specific-flow-diagrams)
  - [4.1. Consolidated Flow (All Modes)](#41-consolidated-flow-all-modes)
  - [4.2. Parentless Mode](#42-parentless-mode)
  - [4.3. Single Parent Mode](#43-single-parent-mode)
  - [4.4. Multi Parent Mode](#44-multi-parent-mode)
  - [4.5. Single Record Mode](#45-single-record-mode)
- [5. Configuration Requirements Matrix](#5-configuration-requirements-matrix)
- [6. Error Handling Flow](#6-error-handling-flow)

---

# 1. Overview

This document provides a comprehensive technical overview of the lresKanbanExplorer component, detailing the method flows and data operations for all supported operation modes.

---

# 2. Operation Modes

LRES Kanban Explorer operates in four distinct modes:

1. **Parentless Mode** - Runs on app/home page without parent object context
2. **Single Parent Mode** - Runs on app/home page with one parent selected
3. **Multi Parent Mode** - Runs on app/home page with multiple parents selected
4. **Single Record Mode** - Runs on a record page with record context

---

# 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 lresKanbanExplorer Component                │
├─────────────────────────────────────────────────────────────┤
│  Public API Methods                                         │
│  ├── @api refresh()                                         │
│  ├── @api getters/setters for configuration                 │
│  └── Event handlers                                         │
├─────────────────────────────────────────────────────────────┤
│  Private Class Methods                                      │
│  ├── performCardRecordsRefresh()                            │
│  ├── refreshParentlessCardRecords()                         │
│  └── applyCardRecordsSnapshot()                             │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (lresKanbanExplorer/dataModeService.js)      │
│  ├── resolveDataMode()                                      │
│  ├── buildDataFetchRequest()                                │
│  ├── executeDataFetch()                                     │
│  ├── refreshParentlessCardRecords()                         │
│  └── performCardRecordsRefresh()                            │
├─────────────────────────────────────────────────────────────┤
│  Apex Controllers                                           │
│  ├── LRES_KanbanCardRecordsController.fetchParentlessCardRecords() - Parentless mode
│  └── LRES_KanbanCardRecordsController.fetchRelatedCardRecords()   - Parent modes
└─────────────────────────────────────────────────────────────┘
```

---

# 4. Mode-Specific Flow Diagrams

## 4.1. Consolidated Flow (All Modes)

```
Component init / config change                              ← Lifecycle Event
    └─ handleConfigChange                                   ← Component Method
        └─ resolveDataMode                                  ← Service Function
            └─ performCardRecordsRefresh                    ← Component Method
                └─ buildDataFetchRequest                    ← Service Function
                    └─ executeDataFetch                     ← Service Function
                        ├─ Parentless:
                        │     refreshParentlessCardRecords  ← Service Function
                        │     └─ fetchParentlessCardRecords ← Apex Method
                        ├─ Parent / Record:
                        │     fetchRelatedCardRecords       ← Apex Method
                        │       (uses parentIds / recordId)
                        └─ applyCardRecordsSnapshot         ← Component Method (shared)
                            └─ Board renders                ← UI Outcome
```

## 4.2. Parentless Mode
**Use Case**: Component on app/home page without `Parent Object API Name` specified
**Configuration Requirements**:
- `cardObjectApiName` ✓
- `groupingFieldApiName` ✓
- `childRelationshipName` ✗ (Not used)

```
Component Initialization ← Lifecycle Event
    • Fires when the component connects
    • Sets default loading state and caches config
        ↓
handleConfigChange() ← Component Method
    • Validates configuration inputs
    • Triggers mode resolution and refresh
        ↓
resolveDataMode() ← Service Function
    • Evaluates readiness based on config
    • Returns { type: "parentless", parentIds: [] }
        ↓
Parentless readiness check ← Conditional
    • Confirms parentless mode, connection, and no parentObjectApiName
    • Ready flag true with empty parentIds array
        ↓
performCardRecordsRefresh() ← Component Method
    • Orchestrates refresh workflow
    • Handles loading/error state updates
        ↓
buildDataFetchRequest() ← Service Function
    • Builds fetch request for mode "parentless"
    • Uses parentIds: []
        ↓
executeDataFetch() ← Service Function
    • Executes request with field list and limits
    • Routes to parentless fetch path
        ↓
refreshParentlessCardRecords() ← Service Function
    • Prepares Apex payload for parentless mode
    • Delegates to fetchParentlessCardRecords()
        ↓
fetchParentlessCardRecords() ← Apex Method
    • Queries child records directly
    • No childRelationshipName needed
    • Returns RelatedRecord[]
        ↓
applyCardRecordsSnapshot() ← Component Method
    • Applies fetched records to board state
    • Clears loading and error indicators
        ↓
Board renders with child records ← UI Outcome
    • Cards display child records only
    • Grouped by configured field
```

## 4.3. Single Parent Mode
**Use Case**: Component on app/home page with single parent selected
**Configuration Requirements**:
- `cardObjectApiName` ✓
- `groupingFieldApiName` ✓
- `childRelationshipName` ✓
- `parentObjectApiName` ✓

```
Parent Selection Change ← User Event
    • User selects a single parent in lookup
    • Emits selection change to component
        ↓
handleParentSelectionChange() ← Component Method
    • Normalizes selection change payload
    • Delegates to applySelectedParentRecords()
        ↓
applySelectedParentRecords([parentId]) ← Component Method
    • Stores selected parentId
    • Updates active parentIds list
        ↓
updateEffectiveRecordId() ← Component Method
    • Aligns recordId with selected parentId
    • Ensures downstream services use active parent
        ↓
handleConfigChange() ← Component Method
    • Re-evaluates configuration with new parent
    • Triggers data mode resolution
        ↓
resolveDataMode() ← Service Function
    • Confirms parent mode readiness
    • Returns { type: "parent", parentIds: [parentId] }
        ↓
performCardRecordsRefresh() ← Component Method
    • Starts refresh pipeline
    • Manages loading/error state
        ↓
buildDataFetchRequest() ← Service Function
    • Builds request for mode "parent"
    • Injects parentIds: [parentId]
        ↓
executeDataFetch() ← Service Function
    • Executes fetch with error handling
    • Routes to fetchRelatedCardRecords()
        ↓
fetchRelatedCardRecords() ← Apex Method
    • parentRecordId: parentId
    • childRelationshipName: childRelationshipName
    • Resolves parent-child relationship
    • Returns RelatedRecord[] with parent descriptors
        ↓
applyCardRecordsSnapshot() ← Component Method
    • Applies results to board state
    • Refreshes card/grouping data
        ↓
Board renders with related records ← UI Outcome
    • Cards show children of selected parent
    • Parent badge displayed on cards
```

## 4.4. Multi Parent Mode
**Use Case**: Component on app/home page with multiple parents selected
**Configuration Requirements**:
- `cardObjectApiName` ✓
- `groupingFieldApiName` ✓
- `childRelationshipName` ✓
- `parentObjectApiName` ✓
- `defaultToMultipleParentSelection` ✓

```
Multi-Parent Selection ← User Event
    • User selects multiple parents in lookup
    • Emits updated selection array
        ↓
handleParentSelectionChange() ← Component Method
    • Normalizes selection payload
    • Delegates to applySelectedParentRecords()
        ↓
applySelectedParentRecords([parentId1, parentId2, ...]) ← Component Method
    • Stores multiple parentIds
    • Updates active parentIds list
        ↓
updateEffectiveRecordId() ← Component Method
    • Keeps recordId aligned with primary parent (if any)
    • Ensures services reference active parents
        ↓
handleConfigChange() ← Component Method
    • Re-evaluates configuration with multi-parent context
    • Triggers data mode resolution
        ↓
resolveDataMode() ← Service Function
    • Confirms parent mode readiness
    • Returns { type: "parent", parentIds: [parentId1, parentId2, ...] }
        ↓
performCardRecordsRefresh() ← Component Method
    • Starts refresh pipeline
    • Manages loading/error state
        ↓
buildDataFetchRequest() ← Service Function
    • Builds request for mode "parent"
    • Injects parentIds: [parentId1, parentId2, ...]
        ↓
executeDataFetch() ← Service Function
    • Executes fetch with error handling
    • Routes to fetchRelatedCardRecords()
        ↓
fetchRelatedCardRecords() ← Apex Method
    • parentRecordIds: [parentId1, parentId2, ...]
    • childRelationshipName: childRelationshipName
    • Resolves parent-child relationships
    • Returns RelatedRecord[] with parent descriptors
        ↓
applyCardRecordsSnapshot() ← Component Method
    • Applies results to board state
    • Refreshes card/grouping data
        ↓
Board renders with multi-parent context ← UI Outcome
    • Cards show children with parent badges
    • Multi-parent indicators visible on board
```

## 4.5. Single Record Mode
**Use Case**: Component on a record page (lightning__RecordPage)
**Configuration Requirements**:
- `cardObjectApiName` ✓
- `groupingFieldApiName` ✓
- `childRelationshipName` ✓
- `recordId` (automatically provided by page context)

```
Record Page Load ← Platform Event
    • Lightning record page initializes component
    • Supplies `recordId` from page context
        ↓
recordId setter (auto) ← Component Setter
    • Captures recordId from platform
    • Marks hasRecordContext = true
        ↓
updateEffectiveRecordId() ← Component Method
    • Syncs effective record id with context recordId
    • Ensures parentIds array uses record context
        ↓
handleConfigChange() ← Component Method
    • Re-evaluates configuration with record context
    • Triggers data mode resolution
        ↓
resolveDataMode() ← Service Function
    • Confirms parent mode readiness with recordId
    • Returns { type: "parent", parentIds: [recordId] }
        ↓
performCardRecordsRefresh() ← Component Method
    • Starts refresh pipeline
    • Manages loading/error state
        ↓
buildDataFetchRequest() ← Service Function
    • Builds request for mode "parent"
    • Injects parentIds: [recordId]
        ↓
executeDataFetch() ← Service Function
    • Executes fetch with error handling
    • Routes to fetchRelatedCardRecords()
        ↓
fetchRelatedCardRecords() ← Apex Method
    • parentRecordId: recordId
    • childRelationshipName: childRelationshipName
    • Resolves relationship from record context
    • Returns RelatedRecord[] with parent descriptors
        ↓
applyCardRecordsSnapshot() ← Component Method
    • Applies results to board state
    • Refreshes card/grouping data
        ↓
Board renders with record-related data ← UI Outcome
    • Cards show children of the context record
    • Parent badge displayed on cards
```

---

# 5. Configuration Requirements Matrix

| Mode          | cardObjectApiName | groupingFieldApiName | childRelationshipName | parentObjectApiName | recordId      |
| ------------- | ----------------- | -------------------- | --------------------- | ------------------- | ------------- |
| Parentless    | ✓                 | ✓                    | ✗ (Not used)          | ✗ (Not allowed)     | N/A           |
| Single Parent | ✓                 | ✓                    | ✓                     | ✓                   | N/A           |
| Multi Parent  | ✓                 | ✓                    | ✓                     | ✓                   | N/A           |
| Single Record | ✓                 | ✓                    | ✓                     | N/A                 | ✓ (Inherited) |

---

# 6. Error Handling Flow

```
Error Occurs ← Runtime Exception
    • Failure triggered during data fetch or processing
    • Bubble captured by refresh pipeline
        ↓
try/catch in performCardRecordsRefresh() ← Error Handler
    • Wraps refresh operations
    • Ensures downstream state is cleaned up
        ↓
component.logError("Related records refresh failed.", error) ← Logging Utility
    • Records error details for diagnostics
    • Preserves stack for debugging
        ↓
component.errorMessage = component.formatError(error) ← User Message Builder
    • Normalizes error into UI-friendly text
    • Stores message on component state
        ↓
Error displayed to user via UI ← UI Outcome
    • Error banner shows formatted message
    • Board remains in safe state
        ↓
component.isLoading = false ← State Reset
    • Clears loading spinner
    • Allows user to retry actions
```
