import { describe, expect, it } from "vitest";
import { CreateTaskSchema, ListTasksQuerySchema, RegisterSchema } from "../src/lib/validation.js";

// Pure unit tests: no database needed.
describe("CreateTaskSchema", () => {
  it("applies defaults", () => {
    expect(CreateTaskSchema.parse({ title: "a" })).toEqual({
      title: "a",
      status: "todo",
      priority: "medium",
    });
  });
  it("rejects unknown fields (mass-assignment protection)", () => {
    expect(CreateTaskSchema.safeParse({ title: "a", id: "x" }).success).toBe(false);
  });
});

describe("ListTasksQuerySchema", () => {
  it("coerces numeric query strings", () => {
    expect(ListTasksQuerySchema.parse({ limit: "5", offset: "10" })).toMatchObject({
      limit: 5,
      offset: 10,
    });
  });
});

describe("RegisterSchema", () => {
  it("trims and lower-cases the email", () => {
    expect(RegisterSchema.parse({ email: " Ana@Example.com ", password: "12345678" }).email).toBe("ana@example.com");
  });
  it("does not trim passwords (spaces are allowed characters)", () => {
    expect(RegisterSchema.parse({ email: "a@b.co", password: "  spaced  " }).password).toBe("  spaced  ");
  });
});
