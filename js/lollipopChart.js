import { chartSvg, emptyState, formatCompactPercent, formatValue, getValueLabel, matchesFilters, tooltipRows } from "./utils.js";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js";

export function renderLollipopChart(rows, state) {
  d3.select("#lollipop-subtitle").text(`Fastest worsening and improving | ${state.year} | ${getValueLabel(state)}`);
  const current = rows.filter((row) => matchesFilters(row, state) && row.yoyChangePct !== null && Number.isFinite(row.yoyChangePct));
  const grouped = d3.rollups(
    current,
    (items) => ({
      yoy: d3.mean(items, (row) => row.yoyChangePct),
      prev: d3.mean(items.filter((row) => row.valuePrevYear !== null), (row) => row.valuePrevYear),
      value: d3.mean(items, (row) => row.value),
      row: items[0],
    }),
    (row) => row.countryName,
  ).map(([country, data]) => ({ country, ...data })).filter((item) => Number.isFinite(item.yoy));

  const improving = grouped.filter((item) => item.yoy < 0).sort((a, b) => d3.ascending(a.yoy, b.yoy)).slice(0, 6);
  const worsening = grouped.filter((item) => item.yoy > 0).sort((a, b) => d3.descending(a.yoy, b.yoy)).slice(0, 6).reverse();
  const data = [...improving, ...worsening];

  if (!data.length) {
    emptyState("#lollipop-chart", "No valid YoY values for current filters");
    return;
  }

  const margin = { top: 14, right: 28, bottom: 44, left: 145 };
  const { svg, innerWidth, innerHeight } = chartSvg("#lollipop-chart", 390, margin);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const extent = d3.extent(data, (d) => d.yoy);
  const pad = Math.max(Math.abs(extent[0] || 0), Math.abs(extent[1] || 0), 1);
  const x = d3.scaleLinear().domain([-pad, pad]).nice().range([0, innerWidth]);
  const y = d3.scaleBand().domain(data.map((d) => d.country)).range([0, innerHeight]).padding(0.35);

  g.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", innerHeight).attr("stroke", "#667085").attr("stroke-dasharray", "4 3");
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0));
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(6).tickFormat(formatCompactPercent));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 38).attr("text-anchor", "middle").attr("class", "chart-title-note").text("Year-over-Year Change (%)");

  g.selectAll(".stem")
    .data(data)
    .join("line")
    .attr("class", "stem")
    .attr("x1", x(0))
    .attr("x2", (d) => x(d.yoy))
    .attr("y1", (d) => y(d.country) + y.bandwidth() / 2)
    .attr("y2", (d) => y(d.country) + y.bandwidth() / 2)
    .attr("stroke", (d) => d.yoy >= 0 ? "#c8543b" : "#268b5f")
    .attr("stroke-width", 2);

  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.yoy))
    .attr("cy", (d) => y(d.country) + y.bandwidth() / 2)
    .attr("r", 6)
    .attr("fill", (d) => d.yoy >= 0 ? "#c8543b" : "#268b5f")
    .on("mousemove", (event, d) => {
      showTooltip(event, `<strong>${d.country}</strong>${tooltipRows([
        ["Previous Value", d.prev === undefined ? "Unavailable" : formatValue(d.prev)],
        ["Current Value", formatValue(d.value)],
        ["YoY Change", formatCompactPercent(d.yoy)],
        ["Direction", d.row.yoyDirection],
        ["Metric", getValueLabel(state)],
      ])}`);
      moveTooltip(event);
    })
    .on("mouseout", hideTooltip);
}
