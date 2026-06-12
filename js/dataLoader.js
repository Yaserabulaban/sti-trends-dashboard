export async function loadDashboardData() {
  const [rows, metricCatalog, dataDictionary, world] = await Promise.all([
    d3.csv("data/processed/sti_dashboard_clean.csv", parseRow),
    d3.json("data/processed/metric_catalog.json"),
    d3.json("data/processed/data_dictionary.json"),
    d3.json("data/map/countries.geojson"),
  ]);

  return { rows, metricCatalog, dataDictionary, world };
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = +value;
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRow(row) {
  return {
    disease: row.disease,
    diseaseType: row.disease_type,
    metric: row.metric,
    countryCode: row.country_code,
    countryAlpha2: row.country_alpha2,
    countryName: row.country_name,
    whoRegion: row.who_region || "Other/Unknown",
    year: +row.year,
    value: numberOrNull(row.value),
    valueLow: numberOrNull(row.value_low),
    valueHigh: numberOrNull(row.value_high),
    ciWidth: numberOrNull(row.ci_width),
    burdenTier: row.burden_tier || "UNKNOWN",
    valuePrevYear: numberOrNull(row.value_prev_year),
    yoyChangeAbs: numberOrNull(row.yoy_change_abs),
    yoyChangePct: numberOrNull(row.yoy_change_pct),
    yoyDirection: row.yoy_direction || "UNKNOWN",
    normalizedScore: numberOrNull(row.normalized_score),
    burdenTierScore: numberOrNull(row.burden_tier_score),
  };
}
