export function HyperframesLogo() {
  // byga logo: SVG (berisi PNG maskot) dari public dir studio.
  const height = 28;
  return (
    <img
      src="/byga-logo.svg"
      alt="byga"
      height={height}
      width={height}
      style={{ height, width: height, objectFit: "contain", display: "block" }}
    />
  );
}
