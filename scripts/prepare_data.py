from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "global_sti_intelligence_hiv_gonorrhea_syphilis.csv"
OUT_DIR = ROOT / "data" / "processed"
CLEAN_PATH = OUT_DIR / "sti_dashboard_clean.csv"
CATALOG_PATH = OUT_DIR / "metric_catalog.json"
DICTIONARY_PATH = OUT_DIR / "data_dictionary.json"

NUMERIC_FIELDS = [
    "value",
    "value_low",
    "value_high",
    "ci_width",
    "value_prev_year",
    "yoy_change_abs",
    "yoy_change_pct",
]

CATEGORICAL_FIELDS = [
    "disease",
    "disease_type",
    "metric",
    "country_code",
    "country_alpha2",
    "country_name",
    "who_region",
    "burden_tier",
    "yoy_direction",
]

KEEP_FIELDS = [
    "disease",
    "disease_type",
    "metric",
    "country_code",
    "country_alpha2",
    "country_name",
    "who_region",
    "year",
    "value",
    "value_low",
    "value_high",
    "ci_width",
    "burden_tier",
    "value_prev_year",
    "yoy_change_abs",
    "yoy_change_pct",
    "yoy_direction",
    "normalized_score",
    "burden_tier_score",
]

DISEASE_LABELS = {
    "hiv": "HIV",
    "gonorrhea": "Gonorrhea",
    "syphilis": "Syphilis",
}

BURDEN_TIER_SCORE = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "VERY HIGH": 4,
}


def clean_text(value: str | None) -> str:
    return " ".join((value or "").strip().split())


def clean_numeric(value: str | None) -> float | None:
    raw = clean_text(value)
    if not raw:
        return None
    raw = raw.replace(",", "").replace("%", "")
    try:
        number = float(raw)
    except ValueError:
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def clean_tier(value: str | None) -> str:
    tier = clean_text(value).upper().replace("_", " ")
    tier = " ".join(tier.split())
    if tier in BURDEN_TIER_SCORE:
        return tier
    if tier in {"VERYHIGH", "VERY-HIGH"}:
        return "VERY HIGH"
    return "UNKNOWN"


def format_number(value: float | int | None) -> str:
    if value is None:
        return ""
    if isinstance(value, int):
        return str(value)
    return f"{value:.6g}"


def read_rows() -> list[dict[str, object]]:
    if not RAW_PATH.exists():
        raise FileNotFoundError(f"Missing raw CSV: {RAW_PATH}")

    cleaned: list[dict[str, object]] = []
    with RAW_PATH.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            year_value = clean_numeric(row.get("year"))
            if year_value is None:
                continue
            year = int(year_value)
            if year < 1990 or year > 2024:
                continue

            for field in CATEGORICAL_FIELDS:
                row[field] = clean_text(row.get(field))

            for field in NUMERIC_FIELDS:
                row[field] = clean_numeric(row.get(field))

            if not row["country_name"] or not row["disease"] or not row["metric"]:
                continue
            if row["value"] is None:
                continue

            row["disease"] = DISEASE_LABELS.get(str(row["disease"]).lower(), str(row["disease"]).title())
            row["disease_type"] = str(row["disease_type"]).title() or "Unknown"
            row["country_code"] = str(row["country_code"]).upper()
            row["country_alpha2"] = str(row["country_alpha2"]).upper()
            row["who_region"] = row["who_region"] or "Other/Unknown"
            row["burden_tier"] = clean_tier(str(row["burden_tier"]))
            row["burden_tier_score"] = BURDEN_TIER_SCORE.get(str(row["burden_tier"]))
            row["yoy_direction"] = str(row["yoy_direction"]).upper() or "UNKNOWN"
            row["year"] = year
            row["normalized_score"] = None
            cleaned.append(row)
    return cleaned


def add_normalized_scores(rows: list[dict[str, object]]) -> None:
    maxima: dict[tuple[str, str], float] = defaultdict(float)
    for row in rows:
        key = (str(row["disease"]), str(row["metric"]))
        value = row["value"]
        if isinstance(value, (int, float)) and value > maxima[key]:
            maxima[key] = float(value)

    for row in rows:
        key = (str(row["disease"]), str(row["metric"]))
        max_value = maxima.get(key)
        value = row["value"]
        if not max_value or not isinstance(value, (int, float)):
            row["normalized_score"] = None
            continue
        row["normalized_score"] = max(0.0, min(1.0, float(value) / max_value))


def write_clean_csv(rows: list[dict[str, object]]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with CLEAN_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=KEEP_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            output = {}
            for field in KEEP_FIELDS:
                value = row.get(field)
                if isinstance(value, float):
                    output[field] = format_number(value)
                elif value is None:
                    output[field] = ""
                else:
                    output[field] = value
            writer.writerow(output)


def write_metric_catalog(rows: list[dict[str, object]]) -> None:
    catalog: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    seen: set[tuple[str, str, str]] = set()
    for row in rows:
        disease = str(row["disease"])
        disease_type = str(row["disease_type"])
        metric = str(row["metric"])
        key = (disease, disease_type, metric)
        if key in seen:
            continue
        seen.add(key)
        catalog[disease][disease_type].append(metric)

    payload = {
        disease: {
            disease_type: sorted(metrics)
            for disease_type, metrics in sorted(type_map.items())
        }
        for disease, type_map in sorted(catalog.items())
    }
    with CATALOG_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def write_data_dictionary() -> None:
    payload = {
        "dataset": "Global STI Trends Dashboard cleaned dataset",
        "source_file": "data/raw/global_sti_intelligence_hiv_gonorrhea_syphilis.csv",
        "year_filter": "Rows are limited to 1990 through 2024.",
        "fields": {
            "disease": "STI disease group: HIV, Gonorrhea, or Syphilis.",
            "disease_type": "Disease category such as viral or bacterial.",
            "metric": "Indicator/metric name used for raw-value comparisons.",
            "country_code": "ISO alpha-3 country code where available.",
            "country_alpha2": "ISO alpha-2 country code where available.",
            "country_name": "Country or territory name.",
            "who_region": "WHO region label.",
            "year": "Observation year.",
            "value": "Cleaned numeric metric value.",
            "value_low": "Cleaned lower confidence interval value if available.",
            "value_high": "Cleaned upper confidence interval value if available.",
            "ci_width": "Cleaned confidence interval width if available.",
            "burden_tier": "Standardized burden category: LOW, MEDIUM, HIGH, VERY HIGH, or UNKNOWN.",
            "value_prev_year": "Previous-year value for the same series if available.",
            "yoy_change_abs": "Absolute year-over-year change if available.",
            "yoy_change_pct": "Percent year-over-year change if available.",
            "yoy_direction": "Original direction label for year-over-year change.",
            "normalized_score": "Derived value divided by max value within each disease + metric group, capped from 0 to 1.",
            "burden_tier_score": "Derived numeric tier score: LOW=1, MEDIUM=2, HIGH=3, VERY HIGH=4, UNKNOWN=null.",
        },
        "comparison_rules": [
            "Use raw value only when a specific compatible metric is selected.",
            "Use normalized_score for Disease=All, disease share, and dominant disease comparisons.",
            "Do not silently compare incompatible raw metrics across diseases.",
        ],
    }
    with DICTIONARY_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def print_audit(rows: list[dict[str, object]]) -> None:
    years = [int(row["year"]) for row in rows]
    files = [CLEAN_PATH, CATALOG_PATH, DICTIONARY_PATH]
    print("Data audit summary")
    print(f"row count: {len(rows):,}")
    print(f"column count: {len(KEEP_FIELDS):,}")
    print(f"year range: {min(years)}-{max(years)}")
    print(f"number of countries: {len({row['country_name'] for row in rows}):,}")
    print(f"diseases: {', '.join(sorted({str(row['disease']) for row in rows}))}")
    print(f"WHO regions: {', '.join(sorted({str(row['who_region']) for row in rows}))}")
    print(f"number of metrics: {len({row['metric'] for row in rows}):,}")
    for path in files:
        size_kb = path.stat().st_size / 1024
        print(f"{path.relative_to(ROOT)}: {size_kb:,.1f} KB")


def main() -> None:
    rows = read_rows()
    add_normalized_scores(rows)
    write_clean_csv(rows)
    write_metric_catalog(rows)
    write_data_dictionary()
    print_audit(rows)


if __name__ == "__main__":
    main()
