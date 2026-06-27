import { initAnimatedBubbleChart, renderAnimatedBubbleChart } from "./animatedBubbleChart.js";
import { initChoroplethMap, renderChoroplethMap } from "./choroplethMap.js";
import { loadDashboardData } from "./dataLoader.js";
import { renderDonutChart } from "./donutChart.js";
import { initFilters, renderFilters } from "./filters.js";
import { initKpiCards, renderKpiCards } from "./kpiCards.js";
import { renderLollipopChart } from "./lollipopChart.js";
import { renderRankedBarChart } from "./rankedBarChart.js";
import { dashboardState, resetState, subscribe } from "./state.js";
import { renderTimeSeriesChart } from "./timeSeriesChart.js";
import { getValueLabel } from "./utils.js";
import { initTooltip } from "./tooltip.js";

let dashboardData = null;

async function start() {
  if (!window.d3) {
    throw new Error("D3 v7 failed to load. Check your internet connection or CDN access.");
  }

  initTooltip();
  dashboardData = await loadDashboardData();
  initFilters(dashboardData.rows);
  initKpiCards();
  initChoroplethMap();
  initAnimatedBubbleChart();
  initChartClearFilters();
  applyInitialQueryParams(dashboardData.rows);

  subscribe(renderAll);
  renderAll();
  window.addEventListener("resize", debounce(renderAll, 160));
}

function initChartClearFilters() {
  d3.selectAll(".chart-clear-filters").on("click", () => resetState());
}

function renderAll() {
  if (!dashboardData) return;
  renderFilters();
  dashboardState.mode = getValueLabel(dashboardState) === "Normalized Burden Score" ? "normalized" : "rawMetric";
  d3.select("#mode-label").text(`${dashboardState.mode === "normalized" ? "Normalized mode" : "Raw metric mode"}: ${getValueLabel(dashboardState)}`);
  renderKpiCards(dashboardData.rows, dashboardState);
  renderChoroplethMap(dashboardData.rows, dashboardData.world, dashboardState);
  renderRankedBarChart(dashboardData.rows, dashboardState);
  renderTimeSeriesChart(dashboardData.rows, dashboardState);
  renderAnimatedBubbleChart(dashboardData.rows, dashboardState);
  renderLollipopChart(dashboardData.rows, dashboardState);
  renderDonutChart(dashboardData.rows, dashboardState);
}

function debounce(fn, delay) {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  };
}

function applyInitialQueryParams(rows) {
  const params = new URLSearchParams(window.location.search);
  const country = params.get("country");
  const disease = params.get("disease");
  const year = params.get("year");
  if (country && rows.some((row) => row.countryName === country)) {
    dashboardState.country = country;
    dashboardState.selectedCountry = country;
  }
  if (disease && ["HIV", "Gonorrhea", "Syphilis"].includes(disease)) {
    dashboardState.disease = disease;
    dashboardState.selectedDisease = disease;
  }
  if (year && Number.isFinite(+year)) {
    dashboardState.year = +year;
  }
}

start().catch((error) => {
  console.error(error);
  d3.select("main").html(`<section class="chart-panel"><div class="chart-body"><p class="empty-state">Dashboard failed to load: ${error.message}</p></div></section>`);
});
