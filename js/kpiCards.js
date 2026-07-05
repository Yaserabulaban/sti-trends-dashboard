import { filteredRows, formatCompactPercent, formatNumber, formatValue, getRowValue, getValueLabel, getYearLabel, matchesFilters } from "./utils.js";

const kpiDefinitions = [
  ["Global Burden Score", "global"],
  ["Highest Burden Country", "highest"],
  ["Lowest Burden Country", "lowest"],
  ["Dominant Disease", "dominant"],
  ["Fastest Worsening Country", "worsening"],
  ["Fastest Improving Country", "improving"],
];

export function initKpiCards() {
  const cards = d3.select("#kpi-cards")
    .selectAll(".kpi-card")
    .data(kpiDefinitions)
    .enter()
    .append("article")
    .attr("class", "kpi-card");

  cards.append("div").attr("class", "label").text((d) => d[0]);
  cards.append("div").attr("class", "value").attr("data-kpi-value", (d) => d[1]).text("...");
  cards.append("div").attr("class", "sub").attr("data-kpi-sub", (d) => d[1]).text("");
}

export function renderKpiCards(rows, state) {
  const base = filteredRows(rows, state);
  const byCountry = d3.rollups(
    base,
    (items) => d3.sum(items, (row) => getRowValue(row, state)),
    (row) => row.countryName,
  ).map(([country, value]) => ({ country, value })).filter((item) => Number.isFinite(item.value));

  const globalScore = d3.sum(base, (row) => getRowValue(row, state));
  const highest = d3.greatest(byCountry, (item) => item.value);
  const lowest = d3.least(byCountry.filter((item) => item.value > 0), (item) => item.value);
  const dominant = dominantDisease(rows, state);
  const yoy = yoyExtremes(rows, state);
  const yearLabel = getYearLabel(state);
  const context = `${getValueLabel(state)} | ${yearLabel}`;
  const burdenContext = getValueLabel(state) === "Normalized Burden Score"
    ? `Normalized score, not raw deaths/cases | ${yearLabel}`
    : `${getValueLabel(state)} | ${yearLabel}`;

  setCard("global", formatValue(globalScore || 0), context);
  setCard("highest", highest ? highest.country : "No data", highest ? `${formatValue(highest.value)} | ${burdenContext}` : context);
  setCard("lowest", lowest ? lowest.country : "No data", lowest ? `${formatValue(lowest.value)} | ${burdenContext}` : context);
  setCard("dominant", dominant ? dominant.disease : "No data", dominant ? `${formatNumber(dominant.share * 100)}% of normalized burden` : context);
  setCard("worsening", yoy.worsening ? yoy.worsening.countryName : "No data", yoy.worsening ? `${formatCompactPercent(yoy.worsening.yoyChangePct)} YoY | ${yearLabel}` : context);
  setCard("improving", yoy.improving ? yoy.improving.countryName : "No data", yoy.improving ? `${formatCompactPercent(yoy.improving.yoyChangePct)} YoY | ${yearLabel}` : context);
  setStoryInsight({ highest, lowest, dominant, yoy, state, globalScore });
}

function dominantDisease(rows, state) {
  const diseaseRows = rows.filter((row) => matchesFilters(row, state, { includeDisease: false, includeSelectedCountry: true }) && row.normalizedScore !== null);
  const totals = d3.rollups(
    diseaseRows,
    (items) => d3.sum(items, (row) => row.normalizedScore),
    (row) => row.disease,
  ).map(([disease, value]) => ({ disease, value }));
  const total = d3.sum(totals, (item) => item.value);
  const top = d3.greatest(totals, (item) => item.value);
  return top && total ? { ...top, share: top.value / total } : null;
}

function yoyExtremes(rows, state) {
  const yoyRows = rows
    .filter((row) => matchesFilters(row, state))
    .filter((row) => row.yoyChangePct !== null && Number.isFinite(row.yoyChangePct));
  return {
    worsening: d3.greatest(yoyRows.filter((row) => row.yoyChangePct > 0), (row) => row.yoyChangePct),
    improving: d3.least(yoyRows.filter((row) => row.yoyChangePct < 0), (row) => row.yoyChangePct),
  };
}

function setCard(key, value, subtitle) {
  d3.select(`[data-kpi-value="${key}"]`).text(value);
  d3.select(`[data-kpi-sub="${key}"]`).text(subtitle);
}

function setStoryInsight({ highest, lowest, dominant, yoy, state, globalScore }) {
  const target = d3.select("#story-insight");
  if (target.empty()) return;

  if (!highest || !globalScore) {
    target.text("No usable records match the current filters. Broaden the metric, country, region, or burden-tier selection to continue the analysis.");
    return;
  }

  const valueLabel = getValueLabel(state);
  const yearLabel = getYearLabel(state);
  const diseasePhrase = dominant
    ? `${dominant.disease} contributes the largest share (${formatNumber(dominant.share * 100)}%)`
    : "the leading disease cannot be determined for this selection";
  const lowPhrase = lowest ? `, while ${lowest.country} appears lowest among non-zero records` : "";
  const trendPhrase = yoy.worsening && yoy.improving
    ? ` ${yoy.worsening.countryName} is worsening fastest (${formatCompactPercent(yoy.worsening.yoyChangePct)} YoY), while ${yoy.improving.countryName} is improving fastest (${formatCompactPercent(yoy.improving.yoyChangePct)} YoY).`
    : " Year-over-year change is limited for this selection.";

  target.text(`For ${yearLabel}, ${highest.country} has the highest ${valueLabel}${lowPhrase}. ${diseasePhrase}. ${trendPhrase}`);
}
