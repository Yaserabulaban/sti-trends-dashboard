import { setState } from "./state.js";
import { burdenColor, chartColors, chartContextSubtitle, countryKey, filteredRows, formatValue, getRowValue, getValueLabel, getYearLabel, tooltipRows } from "./utils.js";
import { hideTooltip, moveTooltip, showTooltip } from "./tooltip.js";

let resetZoom = () => {};
let currentZoomTransform = d3.zoomIdentity;
let mapContext = null;

export function initChoroplethMap() {
  d3.select("#map-reset").on("click", () => resetZoom());
}

export function renderChoroplethMap(rows, world, state) {
  const container = d3.select("#choropleth-map");
  const yearLabel = getYearLabel(state);
  d3.select("#map-subtitle").text(`Country burden map | ${chartContextSubtitle(state)}`);

  const width = Math.max(640, container.node().clientWidth || 900);
  const height = 470;
  if (!mapContext || mapContext.width !== width || mapContext.height !== height || mapContext.world !== world) {
    createMapShell(container, world, width, height);
  }

  const { svg, zoomLayer, countryLayer, path } = mapContext;
  const current = filteredRows(rows, state, { includeCountry: false, includeSelectedCountry: false });
  const byCode = d3.rollup(
    current,
    (items) => ({
      value: d3.sum(items, (row) => getRowValue(row, state)),
      row: items[0],
    }),
    (row) => row.countryCode,
  );
  const maxValue = d3.max(Array.from(byCode.values()), (item) => item.value) || 1;
  const color = d3.scaleSequentialSqrt(burdenColor).domain([0, maxValue]);

  countryLayer
    .selectAll("path")
    .data(world.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (feature) => {
      const item = byCode.get(countryKey(feature));
      return item ? color(item.value) : chartColors.neutral;
    })
    .attr("stroke", (feature) => {
      const item = byCode.get(countryKey(feature));
      return item?.row.countryName === state.selectedCountry ? chartColors.ink : "#ffffff";
    })
    .attr("stroke-width", (feature) => {
      const item = byCode.get(countryKey(feature));
      return item?.row.countryName === state.selectedCountry ? 1.8 : 0.45;
    })
    .on("mousemove", (event, feature) => {
      const item = byCode.get(countryKey(feature));
      if (!item) {
        showTooltip(event, `<strong>${feature.properties.name}</strong><div>No data for current filters</div>`);
        moveTooltip(event);
        return;
      }
      showTooltip(event, `<strong>${item.row.countryName}</strong>${tooltipRows([
        ["WHO Region", item.row.whoRegion],
        ["Disease", state.disease],
        ["Year", yearLabel],
        [getValueLabel(state), formatValue(item.value)],
        ["Burden Tier", item.row.burdenTier],
      ])}`);
      moveTooltip(event);
    })
    .on("mouseout", hideTooltip)
    .on("click", (event, feature) => {
      event.stopPropagation();
      currentZoomTransform = d3.zoomTransform(svg.node());
      const item = byCode.get(countryKey(feature));
      if (item) setState({ selectedCountry: item.row.countryName, country: item.row.countryName });
    });

  drawLegend(svg, color, width, height, maxValue);
  zoomLayer.attr("transform", currentZoomTransform);
}

function createMapShell(container, world, width, height) {
  const existingSvg = container.select("svg").node();
  if (existingSvg) {
    currentZoomTransform = d3.zoomTransform(existingSvg);
  }

  container.selectAll("*").remove();
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  const zoomLayer = svg.append("g").attr("class", "map-zoom-layer");
  const countryLayer = zoomLayer.append("g").attr("class", "map-country-layer");
  const projection = d3.geoNaturalEarth1().fitSize([width, height - 36], world);
  const path = d3.geoPath(projection);

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [width, height]])
    .on("zoom", (event) => {
      currentZoomTransform = event.transform;
      zoomLayer.attr("transform", event.transform);
    });
  svg.call(zoom);
  svg.call(zoom.transform, currentZoomTransform);
  resetZoom = () => {
    currentZoomTransform = d3.zoomIdentity;
    svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity);
  };

  mapContext = { svg, zoomLayer, countryLayer, path, zoom, width, height, world };
}

function drawLegend(svg, color, width, height, maxValue) {
  svg.selectAll(".map-legend, .map-defs").remove();
  const legendWidth = Math.min(260, width * 0.35);
  const legendX = 18;
  const legendY = height - 28;
  const defs = svg.append("defs").attr("class", "map-defs");
  const gradient = defs.append("linearGradient").attr("id", "map-gradient");
  d3.range(0, 1.01, 0.1).forEach((stop) => {
    gradient.append("stop").attr("offset", `${stop * 100}%`).attr("stop-color", color(stop * maxValue));
  });
  const legend = svg.append("g").attr("class", "map-legend");
  legend.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", 10)
    .attr("fill", "url(#map-gradient)");
  legend.append("text").attr("x", legendX).attr("y", legendY - 6).attr("class", "chart-title-note").text("Low");
  legend.append("text").attr("x", legendX + legendWidth).attr("y", legendY - 6).attr("text-anchor", "end").attr("class", "chart-title-note").text(formatValue(maxValue));
}
