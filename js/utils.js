export const diseaseColors = new Map([
  ["HIV", "#5b6ee1"],
  ["Gonorrhea", "#e28a2f"],
  ["Syphilis", "#d84f6a"],
]);

export const ALL_METRICS = "__all_metrics__";
export const ALL_METRICS_LABEL = "All metrics (normalized burden)";

export const regionColors = d3.scaleOrdinal()
  .domain(["Africa", "Americas", "Eastern Mediterranean", "Europe", "South-East Asia", "Western Pacific", "Other/Unknown"])
  .range(["#2f855a", "#3182ce", "#805ad5", "#dd6b20", "#d53f8c", "#0f766e", "#718096"]);

export const formatValue = d3.format(",.3~s");
export const formatNumber = d3.format(",.2f");
export const formatPercent = d3.format("+.2f");
export const formatCompactPercent = (value) => `${d3.format("+.3~s")(value)}%`;

export function uniqueSorted(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))).sort(d3.ascending);
}

export function getActiveDisease(state) {
  return state.selectedDisease || state.disease;
}

export function getActiveCountry(state) {
  return state.selectedCountry || (state.country !== "All" ? state.country : null);
}

export function getValueMode(state) {
  return state.disease === "All" && !state.selectedDisease || state.metric === ALL_METRICS ? "normalized" : "rawMetric";
}

export function getValueLabel(state) {
  return getValueMode(state) === "normalized" ? "Normalized Burden Score" : state.metric || "Selected Metric";
}

export function getRowValue(row, state) {
  return getValueMode(state) === "normalized" ? row.normalizedScore : row.value;
}

export function hasUsableValue(row, state) {
  const value = getRowValue(row, state);
  return value !== null && Number.isFinite(value);
}

export function matchesFilters(row, state, options = {}) {
  const {
    includeYear = true,
    includeYearRange = false,
    includeMetric = true,
    includeDisease = true,
    includeDiseaseType = true,
    includeCountry = true,
    includeSelectedCountry = true,
    includeRegion = true,
    includeTier = true,
  } = options;

  if (includeMetric && state.metric && state.metric !== ALL_METRICS && row.metric !== state.metric) return false;
  const activeDisease = getActiveDisease(state);
  if (includeDisease && activeDisease !== "All" && row.disease !== activeDisease) return false;
  if (includeDiseaseType && state.diseaseType !== "All" && row.diseaseType !== state.diseaseType) return false;
  if (includeYear && row.year !== state.year) return false;
  if (includeYearRange && (row.year < state.yearRange[0] || row.year > state.yearRange[1])) return false;
  if (includeCountry && state.country !== "All" && row.countryName !== state.country) return false;
  if (includeSelectedCountry && state.selectedCountry && row.countryName !== state.selectedCountry) return false;
  if (includeRegion && state.whoRegion !== "All" && row.whoRegion !== state.whoRegion) return false;
  if (includeTier && state.burdenTier !== "All" && row.burdenTier !== state.burdenTier) return false;
  return true;
}

export function filteredRows(rows, state, options = {}) {
  return rows.filter((row) => matchesFilters(row, state, options) && hasUsableValue(row, state));
}

export function aggregateBy(rows, keyFn, valueFn = (row) => row.value) {
  const grouped = d3.rollups(
    rows,
    (items) => ({
      rows: items,
      value: d3.sum(items, valueFn),
      mean: d3.mean(items, valueFn),
      count: items.length,
    }),
    keyFn,
  );
  return grouped.map(([key, aggregate]) => ({ key, ...aggregate }));
}

export function chartSvg(containerSelector, height = 340, margin = { top: 18, right: 28, bottom: 44, left: 62 }) {
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();
  const width = Math.max(320, container.node().clientWidth || 640);
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  return { svg, width, height, margin, innerWidth: width - margin.left - margin.right, innerHeight: height - margin.top - margin.bottom };
}

export function emptyState(containerSelector, message) {
  const { svg, width, height } = chartSvg(containerSelector, 320, { top: 0, right: 0, bottom: 0, left: 0 });
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .attr("class", "empty-state")
    .text(message);
}

export function selectedMetricSubtitle(state) {
  return `${getValueLabel(state)} | ${state.year} | ${getActiveDisease(state)} | ${getActiveCountry(state) || state.whoRegion}`;
}

export function tooltipRows(rows) {
  return rows.map(([label, value]) => `<div><b>${label}:</b> ${value ?? "Unavailable"}</div>`).join("");
}

export function countryKey(feature) {
  return feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3 || feature.properties?.adm0_a3 || feature.properties?.name;
}
