import { describe, expect, it } from "vitest"

import { evaluateTemplateExpression } from "./evaluateTemplateExpression.js"

const props = {
  name: "The Mayor of Casterbridge",
  author: "Thomas Hardy",
  rating: 4,
  tags: ["classic", "novel"],
  book: {
    publisher: "Moonji",
  },
}

describe("evaluateTemplateExpression", () => {
  it("evaluates identifiers, member access, array methods, and template literals", () => {
    expect(evaluateTemplateExpression("name", props)).toBe("The Mayor of Casterbridge")
    expect(evaluateTemplateExpression("book.publisher", props)).toBe("Moonji")
    expect(evaluateTemplateExpression("rating + 1", props)).toBe(5)
    expect(evaluateTemplateExpression("rating >= 4", props)).toBe(true)
    expect(
      evaluateTemplateExpression("tags.map((tag) => tag.toUpperCase()).join(', ')", props),
    ).toBe("CLASSIC, NOVEL")
    expect(evaluateTemplateExpression("'#'.repeat(rating)", props)).toBe("####")
    expect(evaluateTemplateExpression("name.split(' ').slice(0, 2).join(' ')", props)).toBe(
      "The Mayor",
    )
    expect(evaluateTemplateExpression("`${name} / ${author}`", props)).toBe(
      "The Mayor of Casterbridge / Thomas Hardy",
    )
  })

  it("requires users to handle nullable output explicitly", () => {
    expect(evaluateTemplateExpression("missing ?? 'unknown'", props)).toBe("unknown")
    expect(() => evaluateTemplateExpression("missing", props)).toThrow(/missing identifier/)
  })

  it("blocks globals, constructors, arbitrary calls, and mutation", () => {
    expect(() => evaluateTemplateExpression("process.env", props)).toThrow(/blocked identifier/)
    expect(() => evaluateTemplateExpression("name.constructor", props)).toThrow(/blocked property/)
    expect(() => evaluateTemplateExpression("Date.now()", props)).toThrow(/blocked call/)
    expect(() => evaluateTemplateExpression("rating++", props)).toThrow(/unsupported expression/)
  })

  it("does not execute functions from props", () => {
    expect(() =>
      evaluateTemplateExpression("danger()", {
        danger: "not callable",
      }),
    ).toThrow(/blocked call/)
  })

  it("rejects object and array final values", () => {
    expect(() => evaluateTemplateExpression("tags", props)).toThrow(/unsupported final value/)
    expect(() => evaluateTemplateExpression("book", props)).toThrow(/unsupported final value/)
  })

  it("allows long post text props within the output safety limit", () => {
    expect(evaluateTemplateExpression("text", { text: "x".repeat(50000) })).toBe("x".repeat(50000))
  })

  it("limits expression size and array work", () => {
    expect(evaluateTemplateExpression("'x'.repeat(100000)", props)).toBe("x".repeat(1000))
    expect(() => evaluateTemplateExpression("text", { text: "x".repeat(100001) })).toThrow(
      /output length limit/,
    )
    expect(() =>
      evaluateTemplateExpression("tags", { tags: Array.from({ length: 1001 }, () => "x") }),
    ).toThrow(/unsupported final value/)
    expect(() =>
      evaluateTemplateExpression("tags.map((tag) => tag).join('')", {
        tags: Array.from({ length: 1001 }, () => "x"),
      }),
    ).toThrow(/array iteration limit/)
  })
})
