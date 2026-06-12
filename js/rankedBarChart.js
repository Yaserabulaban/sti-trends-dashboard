import { setState } from "./state.js";
import { chartSvg, emptyState, filteredRows, formatValue, getRowValue, getValueLabel, tooltipRows } from "./utils.js";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js";

export function renderRankedBarChart(rows, state) {
  d3.select("#bar-subtitle").text(`Top 15 countries | ${getValueLabel(state)} | ${state.year}`);
  const current = filteredRows(rows, state, { includeCountry: false, includeSelectedCountry: false });
  const ranked = d3.rollups(
    current,
    (items) => ({
      value: d3.sum(items, (row) => getRowValue(row, state)),
      row: items[0],
    }),
    (row) => row.countryName,
  )
    .map(([country, data]) => ({ country, ...data }))
    .sort((a, b) => d3.descending(a.value, b.value))
    .slice(0, 15);

  if (!ranked.length) {
    emptyState("#ranked-bar-chart", "No ranked country data for current filters");
    return;
  }

  const margin = { top: 10, right: 32, bottom: 44, left: 150 };
  const { svg, innerWidth, innerHeight } = chartSvg("#ranked-bar-chart", 390, margin);
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
    .attr("fill", (d) => d.country === state.selectedCountry ? "#1261a0" : "#69a8d8")
    .on("mousemove", (event, d) => {
      showTooltip(event, `<strong>${d.country}</strong>${tooltipRows([
        ["Rank", ranked.indexOf(d) + 1],
        [getValueLabel(state), formatValue(d.value)],
        ["Disease", d.row.disease],
        ["Year", state.year],
        ["Burden Tier", d.row.burdenTier],
      ])}`);
      moveTooltip(event);
    })
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => setState({ selectedCountry: d.country, country: d.country }));
}
