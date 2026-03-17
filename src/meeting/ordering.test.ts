import { describe, it, expect } from "vitest";
import { orderParticipants } from "./ordering.js";

describe("orderParticipants", () => {
  it("places participants matching lastPattern at the end", () => {
    const names = ["Alice", "Peter Kinder", "Bob"];
    const result = orderParticipants(names, "Kinder");

    expect(result).toHaveLength(3);
    expect(result[result.length - 1]).toBe("Peter Kinder");
  });

  it("is case-insensitive for the lastPattern match", () => {
    const names = ["Alice", "bob kinder", "Charlie"];
    const result = orderParticipants(names, "KINDER");

    expect(result[result.length - 1]).toBe("bob kinder");
  });

  it("handles multiple matching participants at the end", () => {
    const names = ["Alice", "Peter Kinder", "Bob", "Jane Kinder"];
    const result = orderParticipants(names, "Kinder");

    expect(result).toHaveLength(4);
    // Both Kinders should be in the last two positions
    const lastTwo = result.slice(2);
    expect(lastTwo).toContain("Peter Kinder");
    expect(lastTwo).toContain("Jane Kinder");
    // Non-Kinders should be in the first two
    const firstTwo = result.slice(0, 2);
    expect(firstTwo).toContain("Alice");
    expect(firstTwo).toContain("Bob");
  });

  it("handles no matching participants", () => {
    const names = ["Alice", "Bob", "Charlie"];
    const result = orderParticipants(names, "Kinder");

    expect(result).toHaveLength(3);
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("Charlie");
  });

  it("handles empty list", () => {
    expect(orderParticipants([], "Kinder")).toEqual([]);
  });

  it("handles all participants matching", () => {
    const names = ["Peter Kinder", "Jane Kinder"];
    const result = orderParticipants(names, "Kinder");

    expect(result).toHaveLength(2);
    expect(result).toContain("Peter Kinder");
    expect(result).toContain("Jane Kinder");
  });
});
