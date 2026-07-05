let tooltip;

export function initTooltip(selector = "#tooltip") {
  tooltip = d3.select(selector);
  return tooltip;
}

export function showTooltip(event, html) {
  if (!tooltip) initTooltip();
  tooltip.html(html).style("opacity", 1).style("visibility", "visible");
  moveTooltip(event);
}

export function moveTooltip(event) {
  if (!tooltip) return;
  const node = tooltip.node();
  const margin = 14;
  const width = node.offsetWidth || 280;
  const height = node.offsetHeight || 120;
  let x = event.clientX + margin;
  let y = event.clientY + margin;
  if (x + width > window.innerWidth - margin) x = event.clientX - width - margin;
  if (y + height > window.innerHeight - margin) y = event.clientY - height - margin;
  tooltip.style("transform", `translate(${Math.max(margin, x)}px, ${Math.max(margin, y)}px)`);
}

export function hideTooltip() {
  if (!tooltip) return;
  tooltip.style("opacity", 0).style("visibility", "hidden").style("transform", "translate(-9999px, -9999px)");
}
