import { createElement } from "lwc";
import KanbanParentSelector from "c/lresKanbanParentSelector";
import { flushPromises } from "../../lresTestUtils/lresTestUtils";
import fetchParentRecords from "@salesforce/apex/LRES_KanbanParentRecordsController.fetchParentRecords";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import { registerLdsTestWireAdapter } from "@salesforce/wire-service-jest-util";

jest.mock(
  "@salesforce/apex/LRES_KanbanParentRecordsController.fetchParentRecords",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const getObjectInfoAdapter = registerLdsTestWireAdapter(getObjectInfo);

describe("c-lres-kanban-parent-selector", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    fetchParentRecords.mockReset();
  });

  const buildComponent = async (props = {}) => {
    const element = createElement("c-lres-kanban-parent-selector", {
      is: KanbanParentSelector
    });
    Object.assign(element, props);
    document.body.appendChild(element);
    await flushPromises();
    return element;
  };

  it("loads parent options and exposes button label", async () => {
    fetchParentRecords.mockResolvedValue([
      { id: "p1", label: "Parent One", subtitle: "Parent", fields: {} }
    ]);
    const element = await buildComponent({ parentObjectApiName: "Account" });
    await flushPromises();

    expect(fetchParentRecords).toHaveBeenCalled();
    expect(fetchParentRecords).toHaveBeenCalledWith(
      expect.objectContaining({ limitSize: 100, orderByClause: undefined })
    );
    const label = element.shadowRoot.querySelector(
      ".parent-selector_button-label"
    ).textContent;
    expect(label).toContain("Select Parent");
    expect(element.shadowRoot.querySelector("button").disabled).toBe(false);
  });

  it("applies custom parent records limit when provided", async () => {
    fetchParentRecords.mockResolvedValue([
      { id: "p1", label: "Parent One", subtitle: "Parent", fields: {} }
    ]);
    await buildComponent({
      parentObjectApiName: "Account",
      parentRecordsLimit: 55
    });
    await flushPromises();

    expect(fetchParentRecords).toHaveBeenCalledWith(
      expect.objectContaining({ limitSize: 55 })
    );
  });

  it("passes ORDER BY clause when configured", async () => {
    fetchParentRecords.mockResolvedValue([
      { id: "p1", label: "Parent One", subtitle: "Parent", fields: {} }
    ]);
    await buildComponent({
      parentObjectApiName: "Account",
      parentRecordsOrderByClause: "Name DESC"
    });
    await flushPromises();

    expect(fetchParentRecords).toHaveBeenCalledWith(
      expect.objectContaining({ orderByClause: "Name DESC" })
    );
  });

  it("emits selection change from single-select option", async () => {
    fetchParentRecords.mockResolvedValue([
      { id: "p1", label: "Parent One", fields: {} },
      { id: "p2", label: "Parent Two", fields: {} }
    ]);
    const element = await buildComponent({ parentObjectApiName: "Account" });
    const handler = jest.fn();
    element.addEventListener("parentselectionchange", handler);

    element.shadowRoot.querySelector(".parent-selector_button").click();
    await flushPromises();
    const option = element.shadowRoot.querySelector("lightning-input");
    option.dataset.value = "p1";
    option.dispatchEvent(new CustomEvent("change"));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { values: ["p1"] } })
    );
  });

  it("supports multi-select selection helpers", async () => {
    fetchParentRecords.mockResolvedValue([
      { id: "p1", label: "Parent One", fields: {} },
      { id: "p2", label: "Parent Two", fields: {} }
    ]);
    const element = await buildComponent({
      parentObjectApiName: "Account",
      defaultToMultipleParentSelection: true
    });
    const handler = jest.fn();
    element.addEventListener("parentselectionchange", handler);

    element.shadowRoot.querySelector(".parent-selector_button").click();
    await flushPromises();

    const selectAll = element.shadowRoot.querySelector(
      ".parent-selector_menu-link"
    );
    selectAll.click();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { values: ["p1", "p2"] } })
    );

    element.selectedParentRecordIds = ["p1", "p2"];
    await flushPromises();
    const clearAll = element.shadowRoot.querySelector(
      ".parent-selector_menu-link--right"
    );
    clearAll.click();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { values: [] } })
    );
  });

  it("surfaces errors and returns false from refreshOptions when failing", async () => {
    fetchParentRecords.mockRejectedValue(new Error("boom"));
    const element = await buildComponent({ parentObjectApiName: "Account" });
    await flushPromises();

    const errorText = element.shadowRoot.querySelector(
      ".parent-selector_error"
    ).textContent;
    expect(errorText).toBeTruthy();
    const success = await element.refreshOptions();
    expect(success).toBe(false);
  });

  it("keeps parent summary fields scrollable and view link outside the scroll region", async () => {
    fetchParentRecords.mockResolvedValue([
      {
        id: "p1",
        label: "Parent One",
        fields: { Email: "one@example.com" }
      }
    ]);
    getObjectInfoAdapter.emit({
      data: {
        fields: {
          Email: { label: "Email" }
        }
      }
    });
    const element = await buildComponent({
      parentObjectApiName: "Contact",
      parentRecordFieldApiNames: "Email"
    });
    element.selectedParentRecordIds = ["p1"];
    await flushPromises();

    const summary = element.shadowRoot.querySelector(
      ".parent-selector_summary"
    );
    expect(summary).toBeTruthy();

    const scrollRegion = summary.querySelector(
      ".parent-selector_summary-fields-scroll"
    );
    const viewLink = summary.querySelector(".parent-selector_view-link");

    expect(scrollRegion).toBeTruthy();
    expect(viewLink).toBeTruthy();
    expect(scrollRegion.contains(viewLink)).toBe(false);

    const fieldValue = scrollRegion.querySelector(
      ".parent-selector_summary-value"
    );
    expect(fieldValue).toBeTruthy();
    expect(fieldValue.textContent).toBe("one@example.com");
  });

  it("caps the pill width while letting the dropdown grow to the widest option", async () => {
    const longLabel = "0123456789012345678901234567890123456789"; // 40ch
    fetchParentRecords.mockResolvedValue([
      { id: "p1", label: "Short", fields: {} },
      { id: "p2", label: longLabel, fields: {} }
    ]);
    const element = await buildComponent({ parentObjectApiName: "Account" });

    element.shadowRoot.querySelector(".parent-selector_button").click();
    await flushPromises();

    const dropdown = element.shadowRoot.querySelector(".parent-selector_menu");
    expect(dropdown).toBeTruthy();
    expect(dropdown.style.minWidth).toBe("32ch");
    expect(dropdown.style.width).toBe("46ch");
  });

  it("shows search input only when there are more than 10 options", async () => {
    fetchParentRecords.mockResolvedValue(
      Array.from({ length: 11 }).map((_, index) => ({
        id: `p${index}`,
        label: `Parent ${index}`,
        fields: {}
      }))
    );
    const element = await buildComponent({ parentObjectApiName: "Account" });

    element.shadowRoot.querySelector(".parent-selector_button").click();
    await flushPromises();

    const search = element.shadowRoot.querySelector(
      ".parent-selector_search lightning-input"
    );
    expect(search).toBeTruthy();
  });

  it("filters options with a debounced search and resets on clear", async () => {
    fetchParentRecords.mockResolvedValue(
      Array.from({ length: 12 }).map((_, index) => ({
        id: `p${index}`,
        label: index % 2 === 0 ? `Match ${index}` : `Other ${index}`,
        fields: {}
      }))
    );
    const element = await buildComponent({ parentObjectApiName: "Account" });

    element.shadowRoot.querySelector(".parent-selector_button").click();
    await flushPromises();

    jest.useFakeTimers();
    try {
      const search = element.shadowRoot.querySelector(
        ".parent-selector_search lightning-input"
      );
      expect(search).toBeTruthy();

      search.value = "Match";
      search.dispatchEvent(new CustomEvent("change"));
      const settleSearch = flushPromises();
      jest.runAllTimers();
      await settleSearch;

      const filteredRows = element.shadowRoot.querySelectorAll(
        ".parent-selector_option-row"
      );
      expect(filteredRows.length).toBe(6); // matches even indices

      search.value = "";
      search.dispatchEvent(new CustomEvent("change"));
      const settleClear = flushPromises();
      jest.runAllTimers();
      await settleClear;

      const resetRows = element.shadowRoot.querySelectorAll(
        ".parent-selector_option-row"
      );
      expect(resetRows.length).toBe(12);
    } finally {
      jest.useRealTimers();
    }
  });

  it("filters options in multi-select mode and restores when cleared", async () => {
    fetchParentRecords.mockResolvedValue(
      Array.from({ length: 12 }).map((_, index) => ({
        id: `p${index}`,
        label: index % 2 === 0 ? `Keep ${index}` : `Drop ${index}`,
        fields: {}
      }))
    );
    const element = await buildComponent({
      parentObjectApiName: "Account",
      defaultToMultipleParentSelection: true
    });

    element.shadowRoot.querySelector(".parent-selector_button").click();
    await flushPromises();

    jest.useFakeTimers();
    try {
      const search = element.shadowRoot.querySelector(
        ".parent-selector_search lightning-input"
      );
      expect(search).toBeTruthy();

      search.value = "Keep";
      search.dispatchEvent(new CustomEvent("change"));
      const settleSearch = flushPromises();
      jest.runAllTimers();
      await settleSearch;

      const filteredRows = element.shadowRoot.querySelectorAll(
        ".parent-selector_option-row"
      );
      expect(filteredRows.length).toBe(6);

      search.value = "";
      search.dispatchEvent(new CustomEvent("change"));
      const settleClear = flushPromises();
      jest.runAllTimers();
      await settleClear;

      const resetRows = element.shadowRoot.querySelectorAll(
        ".parent-selector_option-row"
      );
      expect(resetRows.length).toBe(12);
    } finally {
      jest.useRealTimers();
    }
  });
});
