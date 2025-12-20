import { LightningElement, api, track, wire } from "lwc";
import getHierarchy from "@salesforce/apex/LRES_HierarchyExplorerController.getHierarchy";
import { normalizeString } from "c/lresFieldUtils";
import { parseError, showErrorToast } from "c/lresErrorHandler";
import { buildOrthogonalPaths, computeTreeLayout } from "./layout";
import { NavigationMixin } from "lightning/navigation";
import { nextZoomScale } from "./panZoom";
import { getObjectInfos } from "lightning/uiObjectInfoApi";
import {
  coerceIconName,
  getFieldLabel,
  resolveEmoji
} from "c/lresFieldDisplayUtils";

const MAX_LEVELS = 10;
const MAX_NODES = 50;

export default class LresHierarchyExplorer extends NavigationMixin(
  LightningElement
) {
  _recordId;
  _templateDeveloperName;
  _rootRecordId;

  @api
  get recordId() {
    return this._recordId;
  }
  set recordId(value) {
    this._recordId = value;
    this.scheduleRefresh();
  }

  @api
  get templateDeveloperName() {
    return this._templateDeveloperName;
  }
  set templateDeveloperName(value) {
    this._templateDeveloperName = value;
    this.scheduleRefresh();
  }

  @api
  get rootRecordId() {
    return this._rootRecordId;
  }
  set rootRecordId(value) {
    this._rootRecordId = value;
    this.scheduleRefresh();
  }

  @track hierarchy;
  @track errorMessage;
  @track isLoading = false;
  @track positionedNodes = [];
  @track connectorPaths = [];

  objectApiNames;
  _objectInfoByApiName = {};

  _canvasWidth = 0;
  _canvasHeight = 0;

  _scale = 1;
  _translateX = 0;
  _translateY = 0;
  _isPanning = false;
  _panStartX = 0;
  _panStartY = 0;
  _panStartTranslateX = 0;
  _panStartTranslateY = 0;
  _activePointerId;

  _refreshScheduled = false;

  @wire(getObjectInfos, { objectApiNames: "$objectApiNames" })
  wiredObjectInfos({ data }) {
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) {
      return;
    }
    const nextMap = {};
    results.forEach((entry) => {
      const info = entry?.result;
      const apiName = entry?.objectApiName || info?.apiName;
      if (apiName && info) {
        nextMap[apiName] = info;
      }
    });
    this._objectInfoByApiName = nextMap;
    if (this.hierarchy) {
      this.buildRenderModel();
    }
  }

  connectedCallback() {
    this.scheduleRefresh();
  }

  @api
  refreshHierarchy() {
    const templateDeveloperName = normalizeString(this.templateDeveloperName);
    const effectiveRootRecordId = this.effectiveRootRecordId;
    if (!templateDeveloperName || !effectiveRootRecordId) {
      this.hierarchy = null;
      this.errorMessage = null;
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;
    getHierarchy({
      templateDeveloperName,
      effectiveRootRecordId,
      maxLevels: MAX_LEVELS,
      maxNodes: MAX_NODES
    })
      .then((result) => {
        this.hierarchy = result;
        this.objectApiNames = this.extractObjectApiNames(result?.nodes);
        this.buildRenderModel();
      })
      .catch((error) => {
        const parsed = parseError(error);
        this.hierarchy = null;
        this.positionedNodes = [];
        this.connectorPaths = [];
        this.errorMessage = parsed.message;
        this.objectApiNames = undefined;
        this._objectInfoByApiName = {};
        showErrorToast(this, error, {
          title: "Hierarchy Explorer Error"
        });
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  scheduleRefresh() {
    if (this._refreshScheduled) {
      return;
    }
    this._refreshScheduled = true;
    Promise.resolve().then(() => {
      this._refreshScheduled = false;
      if (!this.isConnected) {
        return;
      }
      this.refreshHierarchy();
    });
  }

  get effectiveRootRecordId() {
    return (
      normalizeString(this._rootRecordId) || normalizeString(this._recordId)
    );
  }

  get hasError() {
    return Boolean(this.errorMessage);
  }

  get hasData() {
    return Boolean(this.hierarchy);
  }

  get nodeCount() {
    return this.hierarchy?.nodes?.length || 0;
  }

  get isCapped() {
    return Boolean(this.hierarchy?.capped);
  }

  get capMessage() {
    return this.hierarchy?.capMessage || "Results were capped.";
  }

  get canvasWidth() {
    return this._canvasWidth;
  }

  get canvasHeight() {
    return this._canvasHeight;
  }

  get svgViewBox() {
    return `0 0 ${this._canvasWidth} ${this._canvasHeight}`;
  }

  get canvasStyle() {
    return `transform: translate(${this._translateX}px, ${this._translateY}px) scale(${this._scale});`;
  }

  buildRenderModel() {
    const nodes = Array.isArray(this.hierarchy?.nodes)
      ? this.hierarchy.nodes
      : [];
    const edges = Array.isArray(this.hierarchy?.edges)
      ? this.hierarchy.edges
      : [];
    const nodeWidth = 280;
    const nodeHeight = 180;
    const gapX = 60;
    const gapY = 70;

    const { positionsById, bounds } = computeTreeLayout(nodes, edges, {
      nodeWidth,
      nodeHeight,
      gapX,
      gapY
    });

    this._canvasWidth = Math.ceil(bounds.width + gapX);
    this._canvasHeight = Math.ceil(bounds.height + gapY);

    this.positionedNodes = nodes
      .map((node) => {
        const pos = positionsById.get(node.id);
        if (!pos) {
          return null;
        }
        const style = `left:${pos.left}px;top:${pos.top}px;width:${nodeWidth}px;max-height:${nodeHeight}px;`;
        return { id: node.id, card: this.normalizeCardForDisplay(node), style };
      })
      .filter(Boolean);

    this.connectorPaths = buildOrthogonalPaths(edges, positionsById);
  }

  normalizeCardForDisplay(card) {
    if (!card) {
      return card;
    }
    const objectApiName = normalizeString(card.objectApiName);
    const titleMeta =
      card.titleEmoji || card.titleIcon
        ? this.parseIconEntry(card.titleEmoji || card.titleIcon)
        : { iconName: null, emoji: null };
    const details = Array.isArray(card.details) ? card.details : [];
    const normalizedDetails = details.map((detail) => {
      const token = detail?.iconEmoji || detail?.iconName;
      const iconMeta = token
        ? this.parseIconEntry(token)
        : { iconName: null, emoji: null };
      return {
        ...detail,
        label: this.resolveDetailLabel(
          objectApiName,
          detail?.apiName,
          detail?.label
        ),
        iconName: iconMeta.iconName,
        iconEmoji: iconMeta.emoji
      };
    });
    return {
      ...card,
      showCardFieldLabels: Boolean(card.showCardFieldLabels),
      titleIcon: titleMeta.iconName,
      titleEmoji: titleMeta.emoji,
      details: normalizedDetails
    };
  }

  resolveDetailLabel(objectApiName, fieldPath, fallbackLabel) {
    const apiName = normalizeString(objectApiName);
    const field = normalizeString(fieldPath);
    if (apiName && field) {
      const objectInfo = this._objectInfoByApiName?.[apiName];
      if (objectInfo) {
        const context = { cardObjectApiName: apiName, objectInfo };
        const label = getFieldLabel(context, field);
        if (label) {
          return label;
        }
      }
    }
    return fallbackLabel;
  }

  extractObjectApiNames(nodes) {
    const unique = new Set();
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const apiName = normalizeString(node?.objectApiName);
      if (apiName) {
        unique.add(apiName);
      }
    });
    return unique.size ? Array.from(unique) : undefined;
  }

  parseIconEntry(rawValue) {
    const value = normalizeString(rawValue);
    if (!value) {
      return { iconName: null, emoji: null };
    }
    const emoji = resolveEmoji(value);
    if (emoji) {
      return { iconName: null, emoji };
    }
    return { iconName: coerceIconName(value), emoji: null };
  }

  handleZoomIn(event) {
    event?.stopPropagation?.();
    this._scale = nextZoomScale(this._scale, { direction: "in" });
  }

  handleZoomOut(event) {
    event?.stopPropagation?.();
    this._scale = nextZoomScale(this._scale, { direction: "out" });
  }

  handleCanvasPointerDown(event) {
    if (!event || this._isPanning) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    this._isPanning = true;
    this._activePointerId = event.pointerId;
    this._panStartX = event.clientX;
    this._panStartY = event.clientY;
    this._panStartTranslateX = this._translateX;
    this._panStartTranslateY = this._translateY;
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
    event.preventDefault();
  }

  handleCanvasPointerMove(event) {
    if (!this._isPanning) {
      return;
    }
    if (
      this._activePointerId !== undefined &&
      event.pointerId !== this._activePointerId
    ) {
      return;
    }
    const dx = event.clientX - this._panStartX;
    const dy = event.clientY - this._panStartY;
    this._translateX = this._panStartTranslateX + dx;
    this._translateY = this._panStartTranslateY + dy;
    event.preventDefault();
  }

  handleCanvasPointerUp(event) {
    if (
      this._activePointerId !== undefined &&
      event?.pointerId !== this._activePointerId
    ) {
      return;
    }
    this._isPanning = false;
    this._activePointerId = undefined;
    try {
      event?.currentTarget?.releasePointerCapture?.(event?.pointerId);
    } catch {
      // ignore
    }
    event?.preventDefault?.();
  }

  handleCardTitleClick(event) {
    const recordId = event?.detail?.recordId;
    if (!recordId) {
      return;
    }
    this.openRecordInNewTab(recordId);
  }

  handleCardOpenExternalLink(event) {
    const recordId = event?.detail?.recordId;
    if (!recordId) {
      return;
    }
    this.openRecordInNewTab(recordId);
  }

  async openRecordInNewTab(recordId) {
    try {
      const url = await this[NavigationMixin.GenerateUrl]({
        type: "standard__recordPage",
        attributes: {
          recordId,
          actionName: "view"
        }
      });
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      showErrorToast(this, error, { title: "Navigation Error" });
    }
  }
}
