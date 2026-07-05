export const defaultState = {
  metric: "__all_metrics__",
  disease: "All",
  diseaseType: "All",
  year: 2024,
  yearRange: [1990, 2024],
  country: "All",
  whoRegion: "All",
  burdenTier: "All",
  selectedCountry: null,
  selectedDisease: null,
  mode: "normalized",
  barSort: "desc",
  barLimit: 10,
};

export const dashboardState = { ...defaultState };

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  Object.assign(dashboardState, patch);
  dashboardState.mode = dashboardState.disease === "All" || dashboardState.metric === "__all_metrics__" ? "normalized" : "rawMetric";
  listeners.forEach((listener) => listener(dashboardState));
}

export function resetState() {
  Object.assign(dashboardState, defaultState);
  listeners.forEach((listener) => listener(dashboardState));
}
