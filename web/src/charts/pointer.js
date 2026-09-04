/**
 * The pointer, in the SVG's own coordinate system.
 *
 * The scales produce SVG coordinates, so a pointer measured against anything
 * else is offset by that element's origin. Measuring against the hit rect —
 * which starts at the plot's top-left corner, inside the margins — is the
 * natural mistake, and it fails silently: nothing looks wrong, the chart just
 * reads the value under a point some distance away. Before this existed,
 * hovering the 2026 dot on the calendar chart reported 2022.
 */
export function svgPoint(event) {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget
  const box = svg.getBoundingClientRect()
  // Map client pixels back to SVG units rather than assuming they are the
  // same. They are today — the charts set width and height in pixels and
  // carry no viewBox — so this is insurance against a later change quietly
  // reintroducing the same class of bug.
  const scale = box.width ? (svg.width.baseVal.value || box.width) / box.width : 1
  return {
    x: (event.clientX - box.left) * scale,
    y: (event.clientY - box.top) * scale,
  }
}
