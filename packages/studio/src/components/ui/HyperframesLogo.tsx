export function HyperframesLogo() {
  // byga logo: PNG mascot asset served from the studio's public dir.
  const height = 28;
  return (
    <img
      src="/byga-logo.png"
      alt="byga"
      height={height}
      width={height}
      style={{ height, width: height, objectFit: "contain", display: "block" }}
    />
  );
}
