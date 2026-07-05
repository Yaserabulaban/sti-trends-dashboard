import { setState } from "./state.js?v=dashboard-story-tooltip-20260705";
import { chartColors, chartSvg, emptyState, filteredRows, formatValue, getActiveDisease, getRowValue, getValueLabel, getYearLabel, tooltipRows } from "./utils.js?v=dashboard-story-tooltip-20260705";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js?v=dashboard-story-tooltip-20260705";

let controlsReady = false;

export function initRankedBarChart() {
  if (controlsReady) return;
  controlsReady = true;
  d3.select("#bar-sort-filter").on("change", applyBarFilters);
  d3.select("#bar-limit-filter").on("change", applyBarFilters);
}

export function renderRankedBarChart(rows, state) {
  const orderLabel = state.barSort === "asc" ? "lowest" : "highest";
  const yearLabel = getYearLabel(state);
  d3.select("#bar-sort-filter").property("value", state.barSort);
  d3.select("#bar-limit-filter").property("value", String(state.barLimit));
  const current = filteredRows(rows, state, { includeCountry: false, includeSelectedCountry: false });
  const available = d3.rollups(
    current,
    (items) => ({
      value: d3.sum(items, (row) => getRowValue(row, state)),
      row: items[0],
    }),
    (row) => row.countryName,
  )
    .map(([country, data]) => ({ country, ...data }))
    .sort((a, b) => state.barSort === "asc" ? d3.ascending(a.value, b.value) : d3.descending(a.value, b.value));
  const ranked = available.slice(0, state.barLimit);
  d3.select("#bar-subtitle").text(`Top ${ranked.length} ${orderLabel} countries | ${barFilterSummary(state)}`);

  if (!ranked.length) {
    emptyState("#ranked-bar-chart", "No country data for current bar filters");
    return;
  }

  const margin = { top: 10, right: 32, bottom: 44, left: 150 };
  const chartHeight = Math.max(320, ranked.length * 30 + margin.top + margin.bottom);
  d3.select("#ranked-bar-chart").style("min-height", `${chartHeight}px`);
  const { svg, innerWidth, innerHeight } = chartSvg("#ranked-bar-chart", chartHeight, margin);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([0, d3.max(ranked, (d) => d.value) || 1]).nice().range([0, innerWidth]);
  const y = d3.scaleBand().domain(ranked.map((d) => d.country)).range([0, innerHeight]).padding(0.24);

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0));
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(5).tickFormat(formatValue));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 38).attr("text-anchor", "middle").attr("class", "chart-title-note").text(getValueLabel(state));

  g.selectAll("rect")
    .data(ranked)
    .join("rect")
    .attr("x", 0)
    .attr("y", (d) => y(d.country))
    .attr("height", y.bandwidth())
    .attr("width", (d) => x(d.value))
    .attr("rx", 3)
    .attr("fill", (d) => d.country === state.selectedCountry ? chartColors.primaryDark : chartColors.primarySoft)
    .on("mousemove", (event, d) => {
      showTooltip(event, `<strong>${d.country}</strong>${tooltipRows([
        ["Rank", ranked.indexOf(d) + 1],
        [getValueLabel(state), formatValue(d.value)],
        ["Disease", d.row.disease],
        ["Year", yearLabel],
        ["Burden Tier", d.row.burdenTier],
      ])}`);
      moveTooltip(event);
    })
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => setState({ selectedCountry: d.country, country: d.country }));
}

function applyBarFilters() {
  setState({
    barSort: d3.select("#bar-sort-filter").property("value"),
    barLimit: +d3.select("#bar-limit-filter").property("value"),
  });
}

function barFilterSummary(state) {
  const parts = [
    getValueLabel(state),
    getYearLabel(state),
    getActiveDisease(state),
  ];
  if (state.country !== "All" || state.selectedCountry) parts.push("ranking all matching countries");
  if (state.whoRegion !== "All") parts.push(state.whoRegion);
  if (state.burdenTier !== "All") parts.push(state.burdenTier);
  return parts.join(" | ");
}
