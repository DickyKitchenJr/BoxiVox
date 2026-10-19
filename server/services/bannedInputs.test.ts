import { describe, expect, it } from "vitest";
import { bannedWords, checkForBannedWords } from "../../shared/bannedInputs.js";

describe("shared banned-word filter", () => {
  it("matches words followed by punctuation case-insensitively", () => {
    expect(checkForBannedWords(`${bannedWords[0].toUpperCase()}!`)).toBe(true);
  });

  it("does not match banned words embedded in larger words", () => {
    expect(checkForBannedWords("class!")).toBe(false);
    expect(checkForBannedWords("classless")).toBe(false);
    expect(checkForBannedWords("hasshat")).toBe(false);
  });
});
