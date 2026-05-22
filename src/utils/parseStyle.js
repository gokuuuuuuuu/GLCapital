/**
 * Convert CSS style string to React style object.
 * Usage: style={s("display:flex;gap:12px")}
 */
export function s(cssString) {
  if (!cssString) return {};
  const style = {};
  cssString
    .split(";")
    .filter((r) => r.trim())
    .forEach((rule) => {
      const colonIdx = rule.indexOf(":");
      if (colonIdx === -1) return;
      const prop = rule.slice(0, colonIdx).trim();
      const val = rule.slice(colonIdx + 1).trim();
      const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      style[camelProp] = val;
    });
  return style;
}
