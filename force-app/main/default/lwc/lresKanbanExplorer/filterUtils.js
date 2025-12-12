export function buildFilterDefinitions({
  records = [],
  blueprints = [],
  existingDefinitions = [],
  activeFilterMenuId = null,
  getFilterValueKey,
  getFilterValueLabel,
  sortFilterOptions,
  getFilterButtonClass,
  isSortMenuOpen = false,
  logDebug = () => {}
}) {
  const dataset = records || [];
  const previous = new Map(existingDefinitions.map((def) => [def.id, def]));
  logDebug("Building filter definitions.", {
    blueprintCount: blueprints.length,
    recordCount: dataset.length
  });

  const definitions = blueprints
    .map((bp) => {
      const valueMap = collectFilterValues(dataset, bp, {
        getFilterValueKey,
        getFilterValueLabel
      });
      if (!valueMap.size) {
        return null;
      }
      const prev = previous.get(bp.id);
      const prevSelection = new Set(prev?.selectedValues || []);
      const selectedValues = Array.from(valueMap.keys()).filter((key) =>
        prevSelection.has(key)
      );
      const options = Array.from(valueMap.entries()).map(([value, label]) => ({
        value,
        label,
        selected: selectedValues.includes(value)
      }));
      const orderedOptions = sortFilterOptions(options, bp.field);

      return {
        ...bp,
        options: orderedOptions,
        selectedValues,
        isOpen: prev?.isOpen && activeFilterMenuId === bp.id,
        buttonClass: getFilterButtonClass(bp.id, selectedValues.length > 0)
      };
    })
    .filter(Boolean);

  const activeExists = definitions.some((def) => def.id === activeFilterMenuId);
  const nextActiveMenuId = activeExists ? activeFilterMenuId : null;
  const shouldCloseMenus = !definitions.length && !isSortMenuOpen;

  return {
    definitions,
    activeFilterMenuId: nextActiveMenuId,
    shouldCloseMenus
  };
}

function collectFilterValues(
  records,
  blueprint,
  { getFilterValueKey, getFilterValueLabel }
) {
  const values = new Map();
  (records || []).forEach((record) => {
    const value = getFilterValueKey(record, blueprint);
    if (value === null || value === undefined || value === "") {
      return;
    }
    if (!values.has(value)) {
      const label = getFilterValueLabel(record, blueprint, value);
      values.set(value, label || value);
    }
  });
  return values;
}
