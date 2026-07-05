import { setState } from "./state.js?v=dashboard-story-tooltip-20260705";
import { ALL_YEARS, chartColors, chartSvg, diseaseColors, emptyState, filteredRows, formatCompactPercent, formatValue, getRowValue, getValueLabel, getYearLabel, regionColors, tooltipRows } from "./utils.js?v=dashboard-story-tooltip-20260705";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js?v=dashboard-story-tooltip-20260705";

let timer = null;

export function initAnimatedBubbleChart() {
  d3.select("#bubble-toggle").on("click", () => {
    if (timer) {
      stopTimer();
      return;
    }
    startTimer();
  });
  d3.select("#bubble-year-slider").on("input", (event) => {
    stopTimer();
    setState({ year: +event.target.value });
  });
}

export function renderAnimatedBubbleChart(rows, state) {
  const yearLabel = getYearLabel(state);
  const isAllYears = state.year === ALL_YEARS;
  const sliderYear = state.year === ALL_YEARS ? state.yearRange[1] : state.year;
  if (isAllYears && timer) stopTimer();
  d3.select(".bubble-controls").classed("all-years-mode", isAllYears);
  d3.select("#bubble-year-slider").property("value", sliderYear).property("disabled", isAllYears);
  d3.select("#bubble-toggle").property("disabled", isAllYears);
  d3.select("#bubble-year-label").text(yearLabel);
  d3.select("#bubble-toggle").text(timer ? "Pause" : "Play");
  d3.select("#bubble-all-years-note").text("Aggregated across all years");
  d3.select("#bubble-subtitle").text(`${getValueLabel(state)} vs YoY change | ${yearLabel}`);

  const current = filteredRows(rows, state, { includeSelectedCountry: false });
  const bubbles = d3.rollups(
    current,
    (items) => {
      const value = d3.sum(items, (row) => getRowValue(row, state));
      const yoy = d3.mean(items.filter((row) => row.yoyChangePct !== null), (row) => row.yoyChangePct);
      const tier = d3.mean(items.filter((row) => row.burdenTierScore !== null), (row) => row.burdenTierScore);
      return { value, yoy, tier, row: items[0] };
    },
    (row) => `${row.countryName}|${row.disease}`,
  ).map(([key, aggregate]) => ({ key, ...aggregate }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => d3.descending(a.value, b.value))
    .slice(0, 80);

  if (!bubbles.length) {
    emptyState("#animated-bubble-chart", "No bubble data for current filters");
    return;
  }

  const hasYoy = bubbles.some((item) => Number.isFinite(item.yoy));
  const { svg, innerWidth, innerHeight, margin } = chartSvg("#animated-bubble-chart", 420);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([0, d3.max(bubbles, (d) => d.value) || 1]).nice().range([0, innerWidth]);
  const y = hasYoy
    ? d3.scaleLinear().domain(d3.extent(bubbles, (d) => Number.isFinite(d.yoy) ? d.yoy : 0)).nice().range([innerHeight, 0])
    : d3.scaleLinear().domain([0.8, 4.2]).range([innerHeight, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(bubbles, (d) => d.value) || 1]).range([4, 28]);
  const color = state.disease === "All" ? (d) => diseaseColors.get(d.row.disease) || chartColors.primary : (d) => regionColors(d.row.whoRegion);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(6).tickFormat(formatValue));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6).tickFormat(hasYoy ? (d) => formatCompactPercent(d) : d3.format(".1f")));
  g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 38).attr("text-anchor", "middle").attr("class", "chart-title-note").text(getValueLabel(state));
  g.append("text").attr("x", -innerHeight / 2).attr("y", -44).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("class", "chart-title-note").text(hasYoy ? "YoY Change (%)" : "Burden Tier Score");

  g.selectAll("circle")
    .data(bubbles)
    .join("circle")
    .attr("cx", (d) => x(d.value))
    .attr("cy", (d) => y(hasYoy ? (Number.isFinite(d.yoy) ? d.yoy : 0) : (d.tier || 1)))
    .attr("r", (d) => r(d.value))
    .attr("fill", color)
    .attr("fill-opacity", 0.72)
    .attr("stroke", (d) => d.row.countryName === state.selectedCountry ? chartColors.ink : "#ffffff")
    .attr("stroke-width", (d) => d.row.countryName === state.selectedCountry ? 2.5 : 1)
    .on("mousemove", (event, d) => {
      showTooltip(event, `<strong>${d.row.countryName}</strong>${tooltipRows([
        ["Disease", d.row.disease],
        ["WHO Region", d.row.whoRegion],
        ["Year", yearLabel],
        [getValueLabel(state), formatValue(d.value)],
        ["YoY Change", Number.isFinite(d.yoy) ? formatCompactPercent(d.yoy) : "Unavailable"],
        ["Burden Tier", d.row.burdenTier],
      ])}`);
      moveTooltip(event);
    })
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => setState({ selectedCountry: d.row.countryName, country: d.row.countryName }));
}

function startTimer() {
  stopTimer();
  d3.select("#bubble-toggle").text("Pause");
  timer = setInterval(() => {
    const slider = d3.select("#bubble-year-slider");
    const current = +slider.property("value");
    const next = current >= 2024 ? 1990 : current + 1;
    slider.property("value", next);
    setState({ year: next });
  }, 900);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
  d3.select("#bubble-toggle").text("Play");
}
