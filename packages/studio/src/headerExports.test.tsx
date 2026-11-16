// @vitest-environment happy-dom
// Imports the header logo and button size classes the way a host app does: by package name.
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { HyperframesLogo, buttonSizes } from "@hyperframes/studio";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("header package exports", () => {
  it("mounts the logo mark", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    const root = createRoot(el);
    await act(async () => root.render(<HyperframesLogo />));
    const logo = el.querySelector('img[alt="byga"]');
    expect(logo).not.toBeNull();
    expect(logo?.getAttribute("src")).toBe("/byga-logo.svg");
    await act(async () => root.unmount());
  });

  it("exposes the button size classes a host reuses for matching chrome", () => {
    expect(buttonSizes.md).toEqual(expect.any(String));
  });
});
