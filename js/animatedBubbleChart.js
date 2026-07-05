import { setState } from "./state.js";
import { ALL_YEARS, chartColors, chartContextSubtitle, chartSvg, diseaseColors, emptyState, filteredRows, formatCompactPercent, formatValue, getRowValue, getValueLabel, getYearLabel, regionColors, tooltipRows, uniqueSorted } from "./utils.js";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js";

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
  const sliderYear = isAllYears ? state.yearRange[1] : state.year;
  if (isAllYears && timer) stopTimer();
  d3.select(".bubble-controls").classed("all-years-mode", isAllYears);
  d3.select("#bubble-year-slider").property("value", sliderYear).property("disabled", isAllYears);
  d3.select("#bubble-toggle").property("disabled", isAllYears).text(timer ? "Pause" : "Play");
  d3.select("#bubble-year-label").text(yearLabel);
  d3.select("#bubble-all-years-note").text("Aggregated across all years");
  d3.select("#bubble-subtitle").text(`Bubble size and position | ${chartContextSubtitle(state)}`);

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
    emptyState(
      "#animated-bubble-chart",
      `No bubble data for ${state.disease} in ${yearLabel} using ${getValueLabel(state)}.`,
      "Try another metric, year, disease, or reset filters.",
    );
    return;
  }

  const hasYoy = bubbles.some((item) => Number.isFinite(item.yoy));
  const chartMargin = { top: 18, right: 190, bottom: 44, left: 62 };
  const { svg, innerWidth, innerHeight, margin } = chartSvg("#animated-bubble-chart", 420, chartMargin);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([0, d3.max(bubbles, (d) => d.value) || 1]).nice().range([0, innerWidth]);
  const y = hasYoy
    ? d3.scaleLinear().domain(d3.extent(bubbles, (d) => Number.isFinite(d.yoy) ? d.yoy : 0)).nice().range([innerHeight, 0])
    : d3.scaleLinear().domain([0.8, 4.2]).range([innerHeight, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(bubbles, (d) => d.value) || 1]).range([4, 28]);
  const isDiseaseColorMode = state.disease === "All";
  const color = isDiseaseColorMode ? (d) => diseaseColors.get(d.row.disease) || chartColors.primary : (d) => regionColors(d.row.whoRegion);

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

  const legendItems = isDiseaseColorMode
    ? ["HIV", "Gonorrhea", "Syphilis"]
    : uniqueSorted(bubbles.map((item) => item.row.whoRegion));
  const legendColor = isDiseaseColorMode ? (item) => diseaseColors.get(item) || chartColors.primary : (item) => regionColors(item);
  const legendX = margin.left + innerWidth + 18;
  const legendY = margin.top + 8;
  drawBubbleLegend(svg, legendItems, legendColor, isDiseaseColorMode ? "Color: Disease" : "Color: WHO Region", legendX, legendY);
  drawSizeLegend(svg, bubbles, r, getValueLabel(state) === "Normalized Burden Score" ? "Normalized Score" : "Selected Value", legendX, legendY + 130);
}

function drawBubbleLegend(svg, items, color, title, x, y) {
  const legend = svg.append("g")
    .attr("class", "legend bubble-legend")
    .attr("transform", `translate(${x},${y})`);

  legend.append("text")
    .attr("class", "chart-title-note")
    .attr("font-weight", 800)
    .attr("y", 0)
    .text(title);

  const rows = legend.selectAll("g")
    .data(items.slice(0, 8))
    .join("g")
    .attr("transform", (d, i) => `translate(0,${18 + i * 22})`);

  rows.append("circle")
    .attr("r", 5)
    .attr("cy", -4)
    .attr("fill", color);

  rows.append("text")
    .attr("x", 12)
    .attr("y", 0)
    .text((d) => d);
}

function drawSizeLegend(svg, bubbles, radiusScale, title, x, y) {
  const maxValue = d3.max(bubbles, (d) => d.value) || 1;
  const values = [maxValue * 0.25, maxValue * 0.55, maxValue].filter((value, index, arr) => value > 0 && arr.indexOf(value) === index);
  const maxRadius = radiusScale(maxValue);
  const legend = svg.append("g")
    .attr("class", "legend bubble-size-legend")
    .attr("transform", `translate(${x},${y})`);

  legend.append("text")
    .attr("class", "chart-title-note")
    .attr("font-weight", 800)
    .attr("y", 0)
    .text(`Size: ${title}`);

  const baseY = 78;
  const rows = legend.selectAll(".bubble-size-item")
    .data(values)
    .join("g")
    .attr("class", "bubble-size-item")
    .attr("transform", (d, i) => `translate(${i * 42},0)`);

  rows.append("circle")
    .attr("cx", maxRadius)
    .attr("cy", (d) => baseY - radiusScale(d))
    .attr("r", (d) => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", "#718096")
    .attr("stroke-width", 1.2);

  rows.append("line")
    .attr("x1", maxRadius)
    .attr("x2", maxRadius + 24)
    .attr("y1", (d) => baseY - radiusScale(d) * 2)
    .attr("y2", (d) => baseY - radiusScale(d) * 2)
    .attr("stroke", "#a0aec0")
    .attr("stroke-dasharray", "3 2");

  rows.append("text")
    .attr("x", maxRadius + 28)
    .attr("y", (d) => baseY - radiusScale(d) * 2 + 4)
    .text((d) => formatValue(d));
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
