import { createElement } from "lwc";
import LresHierarchyExplorer from "c/lresHierarchyExplorer";
import { flushPromises } from "../../lresTestUtils/lresTestUtils";
import { getObjectInfos } from "lightning/uiObjectInfoApi";

import getHierarchy from "@salesforce/apex/LRES_HierarchyExplorerController.getHierarchy";

jest.mock(
  "@salesforce/apex/LRES_HierarchyExplorerController.getHierarchy",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock("lightning/uiObjectInfoApi", () => {
  const { createLdsTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
  return {
    getObjectInfos: createLdsTestWireAdapter()
  };
});

describe("c-lres-hierarchy-explorer", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  const buildComponent = (props = {}) => {
    const element = createElement("c-lres-hierarchy-explorer", {
      is: LresHierarchyExplorer
    });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
  };

  it("uses rootRecordId over recordId when provided", async () => {
    getHierarchy.mockResolvedValue({
      rootId: "002",
      nodes: [{ id: "002", title: "Root", details: [] }],
      edges: [],
      capped: false
    });

    buildComponent({
      recordId: "001",
      rootRecordId: "002",
      templateDeveloperName: "MyTemplate"
    });

    await flushPromises();

    expect(getHierarchy).toHaveBeenCalledWith(
      expect.objectContaining({
        templateDeveloperName: "MyTemplate",
        effectiveRootRecordId: "002",
        maxLevels: 10,
        maxNodes: 50
      })
    );
  });

  it("renders hierarchy cards from Apex response", async () => {
    getHierarchy.mockResolvedValue({
      rootId: "001",
      nodes: [
        { id: "001", title: "Root", details: [], showCardFieldLabels: true },
        { id: "002", title: "Child", details: [], showCardFieldLabels: false }
      ],
      edges: [{ parentId: "001", childId: "002" }],
      capped: false
    });

    const element = buildComponent({
      recordId: "001",
      templateDeveloperName: "MyTemplate"
    });

    await flushPromises();

    const cards = element.shadowRoot.querySelectorAll("c-lres-hierarchy-card");
    expect(cards.length).toBe(2);
    expect(cards[0].showCardFieldLabels).toBe(true);
    expect(cards[1].showCardFieldLabels).toBe(false);
  });

  it("shows warning banner when capped", async () => {
    getHierarchy.mockResolvedValue({
      rootId: "001",
      nodes: [{ id: "001", title: "Root", details: [] }],
      edges: [],
      capped: true,
      capMessage: "Capped at 50 nodes"
    });

    const element = buildComponent({
      recordId: "001",
      templateDeveloperName: "MyTemplate"
    });

    await flushPromises();

    const banner = element.shadowRoot.querySelector(
      ".hierarchy-explorer_warning"
    );
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain("Capped at 50 nodes");
  });

  it("uses UI API metadata labels when available", async () => {
    getHierarchy.mockResolvedValue({
      rootId: "001",
      nodes: [
        {
          id: "001",
          objectApiName: "Account",
          title: "Root",
          details: [
            { apiName: "Custom_Field__c", label: "Custom_Field__c", value: "X" }
          ]
        }
      ],
      edges: [],
      capped: false
    });

    const element = buildComponent({
      recordId: "001",
      templateDeveloperName: "MyTemplate"
    });

    await flushPromises();

    getObjectInfos.emit({
      results: [
        {
          result: {
            apiName: "Account",
            fields: {
              Custom_Field__c: { label: "Custom Field" }
            }
          }
        }
      ]
    });

    await flushPromises();

    const card = element.shadowRoot.querySelector("c-lres-hierarchy-card");
    expect(card.card.details[0].label).toBe("Custom Field");
  });

  it("zooms in when zoom button is clicked", async () => {
    getHierarchy.mockResolvedValue({
      rootId: "001",
      nodes: [{ id: "001", title: "Root", details: [] }],
      edges: [],
      capped: false
    });

    const element = buildComponent({
      recordId: "001",
      templateDeveloperName: "MyTemplate"
    });

    await flushPromises();

    const canvas = element.shadowRoot.querySelector(
      ".hierarchy-explorer_canvas"
    );
    const initialStyle = canvas.getAttribute("style");

    const zoomInButton = element.shadowRoot.querySelector(
      'lightning-button-icon[title="Zoom in"]'
    );
    zoomInButton.click();
    await flushPromises();

    const updatedStyle = canvas.getAttribute("style");
    expect(updatedStyle).not.toBe(initialStyle);
    expect(updatedStyle).toContain("scale(");
  });
});
