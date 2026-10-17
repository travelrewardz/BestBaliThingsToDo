import { describe, expect, it } from "vitest";
import { optionQuestionSchema, tourOptionSchema } from "@/lib/tour-schema";

describe("option booking questions (additional info)", () => {
  it("defaults to TEXT, not required, and trims the label", () => {
    const q = optionQuestionSchema.parse({ label: "  Departure (pick up) Detail  " });
    expect(q).toEqual({
      label: "Departure (pick up) Detail",
      type: "TEXT",
      choices: [],
      required: false,
    });
  });

  it("keeps READ_ONLY notices with their remark", () => {
    const q = optionQuestionSchema.parse({
      label: "Departure ( pick up ) Time",
      type: "READ_ONLY",
      remark: "08:00 AM - 08:30 AM",
      required: true,
    });
    expect(q.type).toBe("READ_ONLY");
    expect(q.remark).toBe("08:00 AM - 08:30 AM");
  });

  it("rejects an empty label and an unknown answer type", () => {
    expect(optionQuestionSchema.safeParse({ label: "   " }).success).toBe(false);
    expect(
      optionQuestionSchema.safeParse({ label: "Pickup", type: "CHOICE" }).success
    ).toBe(false);
  });

  it("accepts SELECT with choices and trims each one", () => {
    const q = optionQuestionSchema.parse({
      label: "Pickup type",
      type: "SELECT",
      choices: [" Hotel ", "Airport", "Port"],
      required: true,
    });
    expect(q.choices).toEqual(["Hotel", "Airport", "Port"]);
    expect(q.required).toBe(true);
  });

  it("rejects SELECT without choices and blank choices", () => {
    expect(
      optionQuestionSchema.safeParse({ label: "Pickup type", type: "SELECT" }).success
    ).toBe(false);
    // every choice must be non-empty after trimming
    expect(
      optionQuestionSchema.safeParse({
        label: "Pickup type",
        type: "SELECT",
        choices: ["Hotel", "   "],
      }).success
    ).toBe(false);
  });

  it("defaults choices to an empty list for TEXT and READ_ONLY", () => {
    expect(optionQuestionSchema.parse({ label: "Notes" }).choices).toEqual([]);
    expect(
      optionQuestionSchema.parse({ label: "Time", type: "READ_ONLY" }).choices
    ).toEqual([]);
  });

  it("caps a label at 120 chars and remark at 300", () => {
    expect(optionQuestionSchema.safeParse({ label: "x".repeat(121) }).success).toBe(false);
    expect(
      optionQuestionSchema.safeParse({ label: "Pickup", remark: "x".repeat(301) }).success
    ).toBe(false);
  });

  it("is carried on options, defaults to no questions, and caps at 10", () => {
    const option = tourOptionSchema.parse({ name: "Morning ride" });
    expect(option.questions).toEqual([]);
    expect(
      tourOptionSchema.safeParse({
        name: "Morning ride",
        questions: Array.from({ length: 11 }, (_, i) => ({ label: `Q${i}` })),
      }).success
    ).toBe(false);
  });
});
