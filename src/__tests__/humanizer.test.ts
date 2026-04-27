import { describe, it, expect } from "vitest";
import { preHumanize, getBannedPatternsCount } from "@/lib/ai/humanizer";

describe("preHumanize - corporate hedge removal", () => {
  it("strips 'It's important to note that' prefix", () => {
    const out = preHumanize("It's important to note that we ship on Fridays.");
    expect(out).toBe("we ship on Fridays.");
  });

  it("strips 'In essence,' prefix", () => {
    const out = preHumanize("In essence, the answer is yes.");
    expect(out).toBe("the answer is yes.");
  });

  it("strips 'Furthermore,' connector", () => {
    const out = preHumanize("Furthermore, we offer a guarantee.");
    expect(out).toBe("we offer a guarantee.");
  });

  it("rewrites 'Additionally,' to 'Also,'", () => {
    const out = preHumanize("Additionally, the price includes shipping.");
    expect(out).toBe("Also, the price includes shipping.");
  });
});

describe("preHumanize - vocabulary substitution", () => {
  it("replaces 'delve into' with 'dig into'", () => {
    const out = preHumanize("Let's delve into the data.");
    expect(out).toContain("dig into");
    expect(out).not.toContain("delve into");
  });

  it("replaces 'leverage' with 'use'", () => {
    const out = preHumanize("We leverage AI to scale.");
    expect(out).toContain("use AI");
    expect(out).not.toContain("leverage");
  });

  it("replaces 'robust' with 'solid'", () => {
    const out = preHumanize("Our robust system handles edge cases.");
    expect(out).toContain("solid system");
    expect(out).not.toContain("robust");
  });

  it("replaces 'navigate' with 'handle'", () => {
    const out = preHumanize("We navigate complex challenges.");
    expect(out).toContain("handle complex challenges");
    expect(out).not.toContain("navigate");
  });

  it("replaces 'in the realm of' with 'in'", () => {
    const out = preHumanize("Innovations in the realm of customer engagement.");
    expect(out).toContain("Innovations in customer engagement.");
    expect(out).not.toContain("realm");
  });

  it("replaces 'tapestry' with 'mix'", () => {
    const out = preHumanize("A rich tapestry of stories.");
    expect(out).toContain("mix");
    expect(out).not.toContain("tapestry");
  });

  it("replaces 'harness' with 'use'", () => {
    const out = preHumanize("We harness automation tools.");
    expect(out).toContain("use automation");
    expect(out).not.toContain("harness");
  });
});

describe("preHumanize - identity hedges", () => {
  it("strips 'As an AI' prefix", () => {
    const out = preHumanize("As an AI, I think we should ship.");
    expect(out).toContain("I think we should ship.");
    expect(out.toLowerCase()).not.toContain("as an ai");
  });

  it("strips 'As an AI assistant' prefix", () => {
    const out = preHumanize("As an AI assistant, I can help.");
    expect(out).toContain("I can help.");
    expect(out.toLowerCase()).not.toContain("as an ai");
  });

  it("rewrites 'I cannot, but I can' contradiction", () => {
    const out = preHumanize("I cannot, but I can offer alternatives.");
    expect(out).toContain("I can offer alternatives.");
    expect(out).not.toContain("I cannot");
  });
});

describe("preHumanize - tricolons", () => {
  it("flattens 'not just X, not just Y, but Z' to 'X, Y, and Z'", () => {
    const out = preHumanize("It's not just fast, not just cheap, but reliable.");
    expect(out).toContain("fast, cheap, and reliable.");
    expect(out).not.toContain("not just");
  });
});

describe("preHumanize - whitespace cleanup", () => {
  it("collapses double spaces left by removals", () => {
    const out = preHumanize("Hello.  Furthermore, we ship today.");
    expect(out).not.toContain("  ");
  });

  it("removes orphan whitespace before punctuation", () => {
    const out = preHumanize("Furthermore , we ship today.");
    expect(out).not.toMatch(/\s+,/);
  });

  it("trims leading and trailing whitespace", () => {
    expect(preHumanize("  hello  ")).toBe("hello");
  });
});

describe("preHumanize - end-to-end real-world example", () => {
  it("strips multiple AI tells from one sentence", () => {
    const input =
      "Furthermore, leveraging this robust solution will navigate complex challenges in the realm of customer engagement.";
    const out = preHumanize(input);
    expect(out).not.toContain("Furthermore");
    expect(out).not.toContain("leverag");
    expect(out).not.toContain("robust");
    expect(out).not.toContain("navigate");
    expect(out).not.toContain("realm");
    // Output should still convey the gist.
    expect(out.toLowerCase()).toContain("customer engagement");
    expect(out.toLowerCase()).toContain("using");
  });

  it("returns empty string unchanged", () => {
    expect(preHumanize("")).toBe("");
  });

  it("preserves text without any AI tells", () => {
    const clean = "Hey - quick one. Can you send the doc by EOD?";
    expect(preHumanize(clean)).toBe(clean);
  });
});

describe("getBannedPatternsCount", () => {
  it("reports a sane number of banned patterns", () => {
    const count = getBannedPatternsCount();
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(50);
  });
});
