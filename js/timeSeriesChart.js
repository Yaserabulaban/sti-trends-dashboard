import { setState } from "./state.js";
import { chartColors, chartContextSubtitle, chartSvg, diseaseColors, emptyState, filteredRows, formatValue, getActiveCountry, getRowValue, getValueLabel, tooltipRows, regionColors } from "./utils.js";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js";

export function renderTimeSeriesChart(rows, state) {
  d3.select("#time-reset-range")
    .property("disabled", state.yearRange[0] === 1990 && state.yearRange[1] === 2024)
    .on("click", () => setState({ yearRange: [1990, 2024] }));

  const activeCountry = getActiveCountry(state);
  const groupMode = activeCountry ? "disease" : state.disease !== "All" ? "region" : "disease";
  d3.select("#time-subtitle").text(`Trends | ${chartContextSubtitle(state, { yearRange: true, groupMode })}`);
  const current = filteredRows(rows, state, { includeYear: false, includeYearRange: true });

  const nested = d3.rollups(
    current,
    (items) => d3.sum(items, (row) => getRowValue(row, state)),
    (row) => groupKey(row, groupMode),
    (row) => row.year,
  ).map(([key, yearMap]) => ({
    key,
    values: yearMap.map(([year, value]) => ({ year, value })).sort((a, b) => d3.ascending(a.year, b.year)),
  })).filter((series) => series.values.length > 1);

  if (!nested.length) {
    emptyState(
      "#time-series-chart",
      `No time-series data for ${getValueLabel(state)} from ${state.yearRange[0]}-${state.yearRange[1]}.`,
      "Try widening the year range or changing disease/metric filters.",
    );
    return;
  }

  const chartMargin = { top: 18, right: 170, bottom: 44, left: 62 };
  const { svg, innerWidth, innerHeight, margin } = chartSvg("#time-series-chart", 390, chartMargin);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain(state.yearRange).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(nested, (series) => d3.max(series.values, (d) => d.value)) || 1]).nice().range([innerHeight, 0]);
  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.value)).defined((d) => Number.isFinite(d.value));
  const color = groupMode === "region" ? regionColors : (key) => diseaseColors.get(key) || chartColors.primary;

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6).tickFormat(formatValue));
  g.append("text").attr("x", -innerHeight / 2).attr("y", -46).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("class", "chart-title-note").text(getValueLabel(state));

  const brush = d3.brushX()
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("end", (event) => {
      if (!event.selection) return;
      const [start, end] = event.selection.map(x.invert).map(Math.round);
      d3.select("#year-start-filter").property("value", start).dispatch("change");
      d3.select("#year-end-filter").property("value", end).dispatch("change");
      g.select(".brush").call(brush.move, null);
    });
  g.append("g").attr("class", "brush").call(brush);

  g.selectAll(".series-line")
    .data(nested)
    .join("path")
    .attr("class", "series-line")
    .attr("fill", "none")
    .attr("stroke", (d) => color(d.key))
    .attr("stroke-width", 2.4)
    .attr("d", (d) => line(d.values));

  const pointData = nested.flatMap((series) => series.values.map((point) => ({ ...point, key: series.key })));
  const showPointTooltip = (event, d) => {
    showTooltip(event, `<strong>${d.key}</strong>${tooltipRows([
      ["Year", d.year],
      [getValueLabel(state), formatValue(d.value)],
    ])}`);
    moveTooltip(event);
  };

  g.selectAll(".series-point")
    .data(pointData)
    .join("circle")
    .attr("r", 3.5)
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.value))
    .attr("fill", (d) => color(d.key))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1)
    .on("mousemove", showPointTooltip)
    .on("mouseout", hideTooltip);

  g.selectAll(".series-hit-area")
    .data(pointData)
    .join("circle")
    .attr("class", "series-hit-area")
    .attr("r", 9)
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.value))
    .attr("fill", "#ffffff")
    .attr("fill-opacity", 0.001)
    .attr("pointer-events", "all")
    .on("mouseover", showPointTooltip)
    .on("mousemove", showPointTooltip)
    .on("mouseout", hideTooltip);

  drawLegend(svg, nested.map((d) => d.key), color, margin.left + innerWidth + 18, margin.top + 6);
}

function groupKey(row, groupMode) {
  if (groupMode === "region") return row.whoRegion;
  return row.disease;
}

function drawLegend(svg, keys, color, x, y) {
  const legend = svg.append("g").attr("class", "legend time-series-legend").attr("transform", `translate(${x},${y})`);
  const items = legend.selectAll("g").data(keys.slice(0, 8)).join("g").attr("transform", (d, i) => `translate(0,${i * 18})`);
  items.append("circle").attr("r", 5).attr("fill", (d) => color(d));
  items.append("text").attr("x", 10).attr("y", 4).text((d) => d);
}
