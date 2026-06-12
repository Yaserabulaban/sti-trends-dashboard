import { setState } from "./state.js";
import { chartSvg, diseaseColors, emptyState, formatNumber, matchesFilters, tooltipRows } from "./utils.js";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js";

const diseases = ["HIV", "Gonorrhea", "Syphilis"];

export function renderDonutChart(rows, state) {
  d3.select("#donut-subtitle").text("Disease Share by Normalized Burden Score");
  const current = rows.filter((row) => matchesFilters(row, state, { includeDisease: false }) && row.normalizedScore !== null);
  const totals = diseases.map((disease) => ({
    disease,
    value: d3.sum(current.filter((row) => row.disease === disease), (row) => row.normalizedScore),
  }));
  const total = d3.sum(totals, (d) => d.value);

  if (!total) {
    emptyState("#donut-chart", "No normalized disease-share data for current filters");
    return;
  }

  const { svg, width, height } = chartSvg("#donut-chart", 390, { top: 16, right: 16, bottom: 16, left: 16 });
  const radius = Math.min(width, height) / 2 - 34;
  const g = svg.append("g").attr("transform", `translate(${width / 2 - 54},${height / 2})`);
  const pie = d3.pie().value((d) => d.value).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
  const labelArc = d3.arc().innerRadius(radius * 0.76).outerRadius(radius * 0.76);

  g.selectAll("path")
    .data(pie(totals))
    .join("path")
    .attr("d", arc)
    .attr("fill", (d) => diseaseColors.get(d.data.disease))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mousemove", (event, d) => {
      showTooltip(event, `<strong>${d.data.disease}</strong>${tooltipRows([
        ["Normalized Burden Share", formatNumber(d.data.value)],
        ["Percentage", `${formatNumber((d.data.value / total) * 100)}%`],
      ])}`);
      moveTooltip(event);
    })
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => setState({ disease: d.data.disease, selectedDisease: d.data.disease }));

  g.selectAll("text")
    .data(pie(totals).filter((d) => d.data.value / total >= 0.06))
    .join("text")
    .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("fill", "#fff")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .text((d) => `${Math.round((d.data.value / total) * 100)}%`);

  const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${width - 150},${height / 2 - 42})`);
  const items = legend.selectAll("g").data(totals).join("g").attr("transform", (d, i) => `translate(0,${i * 26})`);
  items.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", (d) => diseaseColors.get(d.disease));
  items.append("text").attr("x", 18).attr("y", 10).text((d) => `${d.disease} ${formatNumber((d.value / total) * 100)}%`);
}
