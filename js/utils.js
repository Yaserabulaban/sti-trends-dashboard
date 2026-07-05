export const chartColors = {
  primary: "#f97316",
  primarySoft: "#fed7aa",
  primaryDark: "#b91c1c",
  yellow: "#facc15",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#dc2626",
  redDark: "#991b1b",
  neutral: "#f1e5d4",
  ink: "#24130b",
  improving: "#f59e0b",
  worsening: "#dc2626",
};

export const diseaseColors = new Map([
  ["HIV", chartColors.redDark],
  ["Gonorrhea", chartColors.orange],
  ["Syphilis", chartColors.yellow],
]);

export const burdenColor = d3.interpolateYlOrRd;

export const ALL_METRICS = "__all_metrics__";
export const ALL_METRICS_LABEL = "All metrics (normalized burden)";
export const ALL_YEARS = "__all_years__";
export const ALL_YEARS_LABEL = "All years";

export const regionColors = d3.scaleOrdinal()
  .domain(["Africa", "Americas", "Eastern Mediterranean", "Europe", "South-East Asia", "Western Pacific", "Other/Unknown"])
  .range(["#991b1b", "#dc2626", "#f97316", "#f59e0b", "#facc15", "#c2410c", "#9a7b5f"]);

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

export function getYearLabel(state) {
  return state.year === ALL_YEARS ? ALL_YEARS_LABEL : state.year;
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
  if (includeYear && state.year !== ALL_YEARS && row.year !== state.year) return false;
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
  container.selectAll("svg").remove();   // scoped removal, leaves controls intact
  const width = Math.max(320, container.node().clientWidth || 640);
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  return { svg, width, height, margin, innerWidth: width - margin.left - margin.right, innerHeight: height - margin.top - margin.bottom };
}

export function emptyState(containerSelector, message, detail = "Try another metric, year, or reset filters.") {
  const { svg, width, height } = chartSvg(containerSelector, 320, { top: 0, right: 0, bottom: 0, left: 0 });
  const lines = [
    ...wrapText(message, 82).map((text) => ({ text, className: "empty-state-title" })),
    ...wrapText(detail, 86).map((text) => ({ text, className: "empty-state-detail" })),
  ];

  const text = svg.append("text")
    .attr("x", width / 2)
    .attr("y", height / 2 - (lines.length - 1) * 10)
    .attr("text-anchor", "middle")
    .attr("class", "empty-state");

  text.selectAll("tspan")
    .data(lines)
    .join("tspan")
    .attr("x", width / 2)
    .attr("dy", (d, i) => i === 0 ? 0 : 22)
    .attr("class", (d) => d.className)
    .text((d) => d.text);
}

function wrapText(text, maxLength) {
  if (!text) return [];
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

export function selectedMetricSubtitle(state) {
  return `${getValueLabel(state)} | ${getYearLabel(state)} | ${getActiveDisease(state)} | ${getActiveCountry(state) || state.whoRegion}`;
}

export function chartContextSubtitle(state, options = {}) {
  const { yearRange = false, groupMode = null, includeMode = true } = options;
  const parts = [];
  if (includeMode) parts.push(getValueLabel(state));
  parts.push(yearRange ? `${state.yearRange[0]}-${state.yearRange[1]}` : String(getYearLabel(state)));
  if (groupMode) parts.push(`Grouped by ${groupMode}`);
  const activeDisease = getActiveDisease(state);
  if (activeDisease !== "All") parts.push(`Disease: ${activeDisease}`);
  if (state.diseaseType !== "All") parts.push(`Type: ${state.diseaseType}`);
  const activeCountry = getActiveCountry(state);
  if (activeCountry) parts.push(`Country: ${activeCountry}`);
  if (state.whoRegion !== "All") parts.push(`Region: ${state.whoRegion}`);
  if (state.burdenTier !== "All") parts.push(`Tier: ${state.burdenTier}`);
  return parts.join(" | ");
}

export function tooltipRows(rows) {
  return `<div class="tooltip-grid">${rows.map(([label, value]) => `
    <div class="tooltip-row">
      <span class="tooltip-label">${label}</span>
      <span class="tooltip-value">${value ?? "Unavailable"}</span>
    </div>
  `).join("")}</div>`;
}

export function countryKey(feature) {
  return feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3 || feature.properties?.adm0_a3 || feature.properties?.name;
}
