import { getFieldLabel, qualifyFieldName } from "c/lresFieldDisplayUtils";

describe("fieldDisplayUtils.getFieldLabel", () => {
  it("renders nested lookup paths with all segments", () => {
    const component = {
      cardObjectApiName: "Project_Task__c",
      objectInfo: {
        fields: {
          Project__c: {
            relationshipName: "Project__r",
            referenceToInfos: [{ apiName: "Project__c", label: "Project" }]
          },
          OwnerId: {
            relationshipName: "Owner",
            label: "Owner"
          }
        }
      }
    };

    const field = qualifyFieldName(component, "Project__r.Owner.Name");

    expect(getFieldLabel(component, field)).toBe("Project \u2192 Owner \u2192 Name");
  });
});
