# Global STI Trends Dashboard

Interactive single-page D3 dashboard for monitoring HIV, gonorrhea, and syphilis burden worldwide under **SDG 3: Good Health & Well-being**.

The dashboard uses a cleaned version of `global_sti_intelligence_hiv_gonorrhea_syphilis.csv` and focuses on country, WHO region, disease, metric, year, and burden-tier comparisons from 1990 to 2024.

## Dataset Source

The source dataset is the Global STI Intelligence HIV/Gonorrhea/Syphilis CSV derived from WHO Global Health Observatory-style STI indicators.

The raw CSV is intentionally ignored from Git via `data/raw/` because it is large. The dashboard reads the optimized processed file:

`data/processed/sti_dashboard_clean.csv`

## Team Members and Responsibilities

- Yaser E H Abulaban: Multi-Line Time-Series Chart, Animated Bubble Chart, Dashboard Integration
- Chan Ga Wai: Choropleth World Map, Ranked Country Bar Chart, Global Filters
- Mishal Mann Nair: Year-over-Year Lollipop Chart, Disease Share Donut Chart, Linked Interactions

## How to Run

From the project root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Alternative:

```bash
npx serve .
```

The page uses D3.js v7 from CDN, so internet access is needed for the D3 library unless you download and serve D3 locally.

## Regenerate Processed Data

Place the raw CSV at:

```text
data/raw/global_sti_intelligence_hiv_gonorrhea_syphilis.csv
```

Then run:

```bash
python scripts/prepare_data.py
```

The script writes:

- `data/processed/sti_dashboard_clean.csv`
- `data/processed/metric_catalog.json`
- `data/processed/data_dictionary.json`

## Preprocessing Details

The preprocessing workflow is handled by `scripts/prepare_data.py`. The purpose of this step is to convert the large raw CSV into a smaller dashboard-ready dataset that is cleaner, consistent, and safe to compare in D3.

The raw dataset contains many different indicators for HIV, gonorrhea, and syphilis. These indicators are not always directly comparable because some metrics use different units, scales, and meanings. For example, one metric may represent a count, another may represent a rate, and another may represent a percentage. Because of that, the dashboard uses two comparison modes:

- Raw metric mode when the user selects one specific disease and one specific metric.
- Normalized burden mode when the dashboard needs to compare across diseases or across mixed metrics.

### Input File

The preprocessing script reads:

```text
data/raw/global_sti_intelligence_hiv_gonorrhea_syphilis.csv
```

The raw CSV is kept out of Git because it is large. The dashboard does not need to load the raw file directly.

### Fields Kept

Only dashboard-needed columns are kept in the processed CSV. This reduces file size and avoids loading unused fields in the browser.

The cleaned output keeps:

- Disease information: `disease`, `disease_type`, `metric`
- Country and region information: `country_code`, `country_alpha2`, `country_name`, `who_region`
- Time information: `year`
- Main values: `value`, `value_low`, `value_high`, `ci_width`
- Burden category: `burden_tier`
- Year-over-year values: `value_prev_year`, `yoy_change_abs`, `yoy_change_pct`, `yoy_direction`
- Derived fields: `normalized_score`, `burden_tier_score`

### Numeric Cleaning

The script cleans these numeric fields:

```text
value
value_low
value_high
ci_width
value_prev_year
yoy_change_abs
yoy_change_pct
```

For each numeric field, the script:

- Removes extra spaces.
- Removes comma separators and percent signs if present.
- Converts the value into a number.
- Converts empty, invalid, infinite, or not-a-number values into blank/null values.

The dashboard requires a usable `value`, so rows without a valid main `value` are removed.

### Categorical Cleaning

The script also cleans text fields such as:

```text
disease
disease_type
metric
country_code
country_alpha2
country_name
who_region
burden_tier
yoy_direction
```

For these fields, the script:

- Trims leading and trailing spaces.
- Collapses repeated spaces into one space.
- Standardizes country codes to uppercase.
- Keeps `HIV` uppercase instead of converting it to `Hiv`.
- Converts disease type labels into title case.
- Uses `Other/Unknown` when WHO region is missing.
- Uses `UNKNOWN` when burden tier or YoY direction is missing.

### Row Filtering

The processed dataset keeps only rows that are useful for the dashboard.

Rows are kept only when:

- `year` is between 1990 and 2024.
- `country_name` is available.
- `disease` is available.
- `metric` is available.
- `value` is a usable number.

This keeps the dashboard focused on the project period and prevents blank or invalid records from affecting charts, filters, and KPI calculations.

### Burden Tier Standardization

The raw `burden_tier` field is standardized into five possible labels:

```text
LOW
MEDIUM
HIGH
VERY HIGH
UNKNOWN
```

This is important because filters and legends should not treat small spelling or formatting differences as separate categories.

### How `normalized_score` Is Created

The `normalized_score` field is created to support fairer cross-disease comparison.

The script groups rows by:

```text
disease + metric
```

Inside each group, it finds the maximum `value`. Then each row receives:

```text
normalized_score = value / maximum value in the same disease + metric group
```

Example:

```text
Disease: HIV
Metric: Estimated number of people living with HIV

Maximum value in this HIV metric group = 8,000,000
Country A value = 4,000,000

normalized_score = 4,000,000 / 8,000,000
normalized_score = 0.5
```

This means Country A has 50% of the highest observed burden for that specific HIV metric.

The same calculation is done separately for every disease and metric group. Gonorrhea metrics are normalized only against gonorrhea records for the same metric, syphilis metrics are normalized only against syphilis records for the same metric, and HIV metrics are normalized only against HIV records for the same metric.

If a group has no valid maximum value, or if the maximum is zero, `normalized_score` is left blank. Final scores are capped between 0 and 1 so that extreme or invalid values do not break the visual scale.

The dashboard uses `normalized_score` for:

- Disease = All mode
- Disease share donut chart
- Dominant disease KPI
- Cross-disease map, ranking, time-series, and bubble views when raw metric comparison would be misleading

### Why Normalization Is Needed

The dashboard should not silently compare incompatible raw values. A raw HIV count, a gonorrhea resistance percentage, and a syphilis screening indicator can have very different meanings. Comparing those raw numbers directly would make the chart look precise but analytically misleading.

Normalization converts each disease-metric group into a relative 0 to 1 scale. This does not mean all diseases become medically identical. It simply allows the dashboard to show relative burden patterns without mixing incompatible raw units.

Raw values are still used when the user selects a specific metric where direct comparison is valid.

### How `burden_tier_score` Is Created

The `burden_tier_score` field converts ordered burden categories into numbers:

```text
LOW = 1
MEDIUM = 2
HIGH = 3
VERY HIGH = 4
UNKNOWN = blank/null
```

This score is useful when a chart needs a numeric position for burden severity. For example, the animated bubble chart can use `burden_tier_score` as a fallback y-axis when YoY values are missing or too sparse.

The score does not replace the original `burden_tier` label. The dashboard still shows the text label in filters and tooltips.

### Year-over-Year Fields

The raw dataset already includes:

```text
value_prev_year
yoy_change_abs
yoy_change_pct
yoy_direction
```

The preprocessing script cleans these fields but does not recalculate them. The lollipop chart and fastest worsening/improving KPI use `yoy_change_pct`.

Some YoY percentages can be extremely large when the previous year's value is very close to zero. The dashboard keeps those values because they are part of the dataset, but it formats them compactly so the interface remains readable.

### Output Files

The preprocessing script creates three files:

```text
data/processed/sti_dashboard_clean.csv
data/processed/metric_catalog.json
data/processed/data_dictionary.json
```

`sti_dashboard_clean.csv` is the main file loaded by the dashboard.

`metric_catalog.json` lists available metrics by disease and disease type. This supports filter behavior and helps identify which indicators are available under each disease category.

`data_dictionary.json` documents each cleaned field and derived field so the processed dataset is easier to understand and explain in the report.

### Data Audit Summary

After processing, the script prints an audit summary showing:

- Row count
- Column count
- Year range
- Number of countries
- Diseases
- WHO regions
- Number of metrics
- Output file sizes

This audit helps confirm that the processed data still covers the required 1990-2024 period and includes the expected countries, diseases, regions, and metrics.

The raw CSV should stay in `data/raw/` and is ignored from Git. Use the processed files for dashboard loading and final submission.

## Dashboard Features

- Global filters for metric, disease, disease type, year, year range, country, WHO region, and burden tier
- Global reset button plus chart-level `Clear Filters` buttons for faster demo recovery
- KPI cards for global burden score, highest burden country, lowest burden country, dominant disease, fastest worsening country, and fastest improving country
- Shared dashboard state across all filters and charts
- Reusable custom tooltip component across all visualizations
- Short interaction hints on every chart to support grading and live demonstration
- Linked country selection across map, ranked bar chart, animated bubble chart, lollipop chart, time-series context, and KPI cards
- Donut segment click to filter by disease globally
- Choropleth map zoom and pan with a `Reset Zoom` control
- Time-series brush for year-range focus with a `Reset Range` control
- Animated bubble chart with play, pause, year slider, color legend, and bubble-size legend
- Empty-state messages when a filter combination has no chart-ready data
- Responsive CSS grid layout for laptop and smaller screens

## Visualizations

1. Choropleth World Map: spatial burden comparison by country with zoom, pan, country tooltip, country selection, reset zoom, and chart-level filter clearing.
2. Ranked Country Bar Chart: top 15 countries for the selected metric or normalized burden score with custom tooltip and click-to-select country interaction.
3. Multi-Line Time-Series Chart: 1990-2024 trend view grouped by disease or WHO region with custom point tooltips, brush-based year focusing, reset range, and external legend placement.
4. Animated Bubble Chart: temporal country-level animation with play/pause, year slider, color legend, bubble-size legend, custom tooltip, and click-to-select country interaction.
5. Year-over-Year Lollipop Chart: fastest worsening and fastest improving countries using `yoy_change_pct`, including zero baseline, custom tooltip, and click-to-select country interaction.
6. Disease Share Donut Chart: relative disease contribution using normalized burden score with custom tooltip and click-to-filter disease interaction.

## Screenshots and Report Assets

Dashboard screenshots are stored in `docs/screenshots/` for report writing and presentation preparation:

- `full-dashboard.png`
- `full-dashboard-tall.png`
- `filters-kpis.png`
- `choropleth-map.png`
- `ranked-bar-chart.png`
- `time-series-chart.png`
- `animated-bubble-chart.png`
- `lollipop-chart.png`
- `donut-chart.png`
- `linked-interaction-south-africa.png`

The current report draft is stored in:

```text
report/1221305612_1221305898_1221305145.docx
```

The local ChatGPT report handoff prompt is stored in:

```text
docs/HANDOFF_TO_CHATGPT.md
```

Note: `docs/HANDOFF_TO_CHATGPT.md` is a local writing helper and is ignored from Git unless the team decides to include it.

## Normalized Burden Score

The dataset contains many different metrics. Raw values are not always safe to compare across diseases.

For each `disease + metric` group, the preprocessing script creates:

```text
normalized_score = value / max(value in disease + metric group)
```

The value is capped between 0 and 1. Cross-disease views, Disease = All mode, the dominant disease KPI, and the disease share donut use normalized scores.

Raw metric values are used when a specific disease and compatible metric are selected.

## Known Limitations

- D3.js is loaded from CDN, so offline use requires saving D3 locally and updating `index.html`.
- Some year-over-year percentages are extremely large when the previous value is near zero. The dashboard keeps these values because they are present in the dataset, but labels use compact formatting.
- Map joins use ISO-3 country codes from the CSV and GeoJSON. Countries without matching geometry or data appear neutral grey.
- The processed CSV is about 10 MB. It is much smaller than the raw 22 MB CSV, but still large enough that the first page load may take a moment.

## File Structure

```text
DV_Project/
  index.html
  README.md
  .gitignore
  css/
    style.css
  js/
    animatedBubbleChart.js
    choroplethMap.js
    dataLoader.js
    donutChart.js
    filters.js
    kpiCards.js
    lollipopChart.js
    main.js
    rankedBarChart.js
    state.js
    timeSeriesChart.js
    tooltip.js
    utils.js
  data/
    map/
      countries.geojson
    processed/
      sti_dashboard_clean.csv
      metric_catalog.json
      data_dictionary.json
    raw/
      global_sti_intelligence_hiv_gonorrhea_syphilis.csv
  scripts/
    prepare_data.py
  docs/
    screenshots/
      full-dashboard.png
      full-dashboard-tall.png
      filters-kpis.png
      choropleth-map.png
      ranked-bar-chart.png
      time-series-chart.png
      animated-bubble-chart.png
      lollipop-chart.png
      donut-chart.png
      linked-interaction-south-africa.png
  resources/
    1221305612_1221305145_1221305898_Proposal.pdf
    T2610 Project Specification.pdf
```