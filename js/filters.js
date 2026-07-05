import { dashboardState, resetState, setState } from "./state.js";
import { ALL_METRICS, ALL_METRICS_LABEL, ALL_YEARS, ALL_YEARS_LABEL, getActiveDisease, uniqueSorted } from "./utils.js";

const ids = {
  metric: "#metric-filter",
  disease: "#disease-filter",
  diseaseType: "#disease-type-filter",
  year: "#year-filter",
  yearStart: "#year-start-filter",
  yearEnd: "#year-end-filter",
  country: "#country-filter",
  region: "#region-filter",
  tier: "#tier-filter",
};

let cachedRows = [];

export function initFilters(rows) {
  cachedRows = rows;
  d3.select(ids.metric).on("change", (event) => setState({ metric: event.target.value }));
  d3.select(ids.disease).on("change", (event) => setState({ disease: event.target.value, selectedDisease: null }));
  d3.select(ids.diseaseType).on("change", (event) => setState({ diseaseType: event.target.value }));
  d3.select(ids.year).on("change", (event) => {
    const value = event.target.value;
    setState({ year: value === ALL_YEARS ? ALL_YEARS : +value });
  });
  d3.select(ids.yearStart).on("change", handleYearRange);
  d3.select(ids.yearEnd).on("change", handleYearRange);
  d3.select("#apply-year-range").on("click", handleYearRange);
  d3.select(ids.country).on("change", (event) => {
    const country = event.target.value;
    setState({ country, selectedCountry: country === "All" ? null : country });
  });
  d3.select(ids.region).on("change", (event) => setState({ whoRegion: event.target.value, selectedCountry: null, country: "All" }));
  d3.select(ids.tier).on("change", (event) => setState({ burdenTier: event.target.value }));
  d3.select("#reset-filters").on("click", () => resetState());
  renderFilters();
}

export function renderFilters() {
  const diseases = ["All", ...uniqueSorted(cachedRows.map((row) => row.disease))];
  const activeDisease = getActiveDisease(dashboardState);
  const diseaseTypeRows = activeDisease === "All" ? cachedRows : cachedRows.filter((row) => row.disease === activeDisease);
  const diseaseTypes = ["All", ...uniqueSorted(diseaseTypeRows.map((row) => row.diseaseType))];
  const metricRows = cachedRows.filter((row) => {
    if (activeDisease !== "All" && row.disease !== activeDisease) return false;
    if (dashboardState.diseaseType !== "All" && row.diseaseType !== dashboardState.diseaseType) return false;
    return true;
  });
  const metricValues = uniqueSorted(metricRows.map((row) => row.metric));
  const metrics = dashboardState.disease === "All" ? [ALL_METRICS, ...metricValues] : metricValues;
  const years = [ALL_YEARS, ...uniqueSorted(cachedRows.map((row) => row.year)).map(String)];
  const countries = ["All", ...uniqueSorted(cachedRows.map((row) => row.countryName))];
  const regions = ["All", ...uniqueSorted(cachedRows.map((row) => row.whoRegion))];
  const tiers = ["All", ...uniqueSorted(cachedRows.map((row) => row.burdenTier))];

  if (dashboardState.disease === "All" && dashboardState.metric !== ALL_METRICS && !metricValues.includes(dashboardState.metric)) {
    dashboardState.metric = ALL_METRICS;
  }
  if (!metrics.includes(dashboardState.metric)) {
    dashboardState.metric = metrics[0] || ALL_METRICS;
  }
  if (!diseaseTypes.includes(dashboardState.diseaseType)) {
    dashboardState.diseaseType = "All";
  }

  setOptions(ids.metric, metrics, dashboardState.metric);
  setOptions(ids.disease, diseases, dashboardState.disease);
  setOptions(ids.diseaseType, diseaseTypes, dashboardState.diseaseType);
  setOptions(ids.year, years, String(dashboardState.year));
  setOptions(ids.country, countries, dashboardState.country);
  setOptions(ids.region, regions, dashboardState.whoRegion);
  setOptions(ids.tier, tiers, dashboardState.burdenTier);
  d3.select(ids.yearStart).property("value", dashboardState.yearRange[0]);
  d3.select(ids.yearEnd).property("value", dashboardState.yearRange[1]);
}

function setOptions(selector, values, selected) {
  const selection = d3.select(selector)
    .selectAll("option")
    .data(values, (value) => value);

  selection.enter()
    .append("option")
    .merge(selection)
    .attr("value", (value) => value)
    .text((value) => {
      if (value === ALL_METRICS) return ALL_METRICS_LABEL;
      if (value === ALL_YEARS) return ALL_YEARS_LABEL;
      return value;
    });

  selection.exit().remove();
  d3.select(selector).property("value", selected);
}

function handleYearRange() {
  const start = +d3.select(ids.yearStart).property("value");
  const end = +d3.select(ids.yearEnd).property("value");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  setState({ yearRange: [Math.min(start, end), Math.max(start, end)] });
}
