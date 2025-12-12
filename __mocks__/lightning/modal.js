import { LightningElement } from "lwc";

export default class LightningModal extends LightningElement {
  static __nextResult;
  static __openMock;

  static open(params) {
    if (typeof LightningModal.__openMock === "function") {
      return LightningModal.__openMock(params);
    }
    return Promise.resolve(LightningModal.__nextResult);
  }

  close(result) {
    LightningModal.__closeResult = result;
  }
}
