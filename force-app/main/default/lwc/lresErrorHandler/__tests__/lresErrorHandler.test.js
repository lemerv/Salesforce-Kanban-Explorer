import { parseError } from "../lresErrorHandler";

describe("lresErrorHandler.parseError", () => {
  it("returns default message when no details are provided", () => {
    const result = parseError({});
    expect(result.message).toBe("An unexpected error occurred.");
    expect(result.messages).toEqual(["An unexpected error occurred."]);
    expect(result.title).toBe("Error");
  });

  it("handles string errors", () => {
    const result = parseError("Something went wrong");
    expect(result.message).toBe("Something went wrong");
    expect(result.messages).toEqual(["Something went wrong"]);
  });

  it("handles array bodies", () => {
    const result = parseError({
      body: [{ message: "First" }, { message: "Second" }]
    });
    expect(result.message).toBe("First\nSecond");
    expect(result.messages).toEqual(["First", "Second"]);
  });

  it("handles Apex output errors", () => {
    const result = parseError({
      body: {
        output: {
          fieldErrors: {
            Name: [{ message: "Name error" }]
          },
          errors: [{ message: "General output error" }],
          pageErrors: [{ message: "Page error" }]
        },
        message: "Fallback body message"
      },
      message: "Top level message"
    });
    expect(result.messages).toContain("Name error");
    expect(result.messages).toContain("General output error");
    expect(result.messages).toContain("Page error");
    expect(result.message).toBe("Name error\nGeneral output error\nPage error");
  });
});
