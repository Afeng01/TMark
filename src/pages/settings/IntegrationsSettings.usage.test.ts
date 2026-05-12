import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("IntegrationsSettings usage guide", () => {
  it("renders a usage guide that explains MCP, CLI providers, and Alice", () => {
    const source = readFileSync("src/pages/settings/IntegrationsSettings.tsx", "utf8");

    expect(source).toContain("integrations.usageGuide.title");
    expect(source).toContain("integrations.usageGuide.mcp");
    expect(source).toContain("integrations.usageGuide.cliProviders");
    expect(source).toContain("integrations.usageGuide.aliceCli");
  });

  it("keeps guide copy available in English and Simplified Chinese", () => {
    const english = readFileSync("src/locales/en/settings.json", "utf8");
    const chinese = readFileSync("src/locales/zh-CN/settings.json", "utf8");

    expect(english).toContain("integrations.usageGuide.title");
    expect(english).toContain("alice-cli");
    expect(chinese).toContain("integrations.usageGuide.title");
    expect(chinese).toContain("alice-cli");
  });
});
