import { parseSync } from "oxc-parser"

import type { TemplateValue } from "../schema/TemplateValue.js"

const blockedIdentifiers = new Set(["process", "require", "globalThis", "window", "document"])
const blockedProperties = new Set(["constructor", "prototype", "__proto__"])
const allowedArrayMethods = new Set(["filter", "join", "map", "slice"])
const allowedStringMethods = new Set([
  "repeat",
  "replace",
  "split",
  "toLowerCase",
  "toUpperCase",
  "trim",
])
const maxExpressionLength = 1000
const maxEvaluationDepth = 80
const maxArrayIterationLength = 1000
const maxOutputLength = 100000

type PlainObject = Record<string, TemplateValue>
type AstNode = {
  type: string
  [key: string]: unknown
}
type EvaluationScope = Record<string, TemplateValue>

const isAstNode = (value: unknown): value is AstNode =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as { type?: unknown }).type === "string"

const isPlainObject = (value: TemplateValue): value is PlainObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

const isScalarValue = (value: TemplateValue): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const assertOutputLength = (value: TemplateValue) => {
  if (typeof value === "string" && value.length > maxOutputLength) {
    throw new Error("output length limit exceeded")
  }
}

const assertPropertyAllowed = (propertyName: string) => {
  if (blockedProperties.has(propertyName)) {
    throw new Error(`blocked property: ${propertyName}`)
  }
}

const getProperty = ({
  target,
  propertyName,
  missingAsUndefined = false,
}: {
  target: TemplateValue
  propertyName: string
  missingAsUndefined?: boolean
}): TemplateValue => {
  assertPropertyAllowed(propertyName)

  if (Array.isArray(target)) {
    if (propertyName === "length") {
      return target.length
    }

    const index = Number(propertyName)

    if (Number.isInteger(index) && index >= 0) {
      return target[index]
    }

    if (missingAsUndefined) {
      return undefined
    }

    throw new Error(`missing property: ${propertyName}`)
  }

  if (typeof target === "string") {
    if (propertyName === "length") {
      return target.length
    }

    const index = Number(propertyName)

    if (Number.isInteger(index) && index >= 0) {
      return target[index]
    }

    if (missingAsUndefined) {
      return undefined
    }

    throw new Error(`missing property: ${propertyName}`)
  }

  if (!isPlainObject(target) || !(propertyName in target)) {
    if (missingAsUndefined) {
      return undefined
    }

    throw new Error(`missing property: ${propertyName}`)
  }

  return target[propertyName]
}

const toFinalValue = (value: TemplateValue) => {
  if (isScalarValue(value)) {
    assertOutputLength(value)
    return value
  }

  if (value === null || value === undefined) {
    throw new Error("unsupported final value: nullish")
  }

  throw new Error("unsupported final value: object")
}

const toStringValue = (value: TemplateValue) => String(toFinalValue(value))

const toInteger = (value: TemplateValue | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback
  }

  if (typeof value === "number") {
    return Math.trunc(value)
  }

  if (typeof value === "string" && value.trim()) {
    return Math.trunc(Number(value))
  }

  throw new Error("unsupported expression")
}

const getIdentifierName = (node: unknown) => {
  if (!isAstNode(node) || typeof node.name !== "string") {
    throw new Error("unsupported expression")
  }

  return node.name
}

const getLiteralValue = (node: AstNode): TemplateValue => {
  if (!("value" in node)) {
    throw new Error("unsupported expression")
  }

  const value = node.value

  if (value === null || isScalarValue(value as TemplateValue)) {
    return value as TemplateValue
  }

  throw new Error("unsupported expression")
}

const createArrowFunctionEvaluator = ({
  arrowNode,
  scope,
}: {
  arrowNode: AstNode
  scope: EvaluationScope
}) => {
  const params = Array.isArray(arrowNode.params) ? arrowNode.params : []

  if (arrowNode.async || arrowNode.generator || params.length !== 1 || !arrowNode.expression) {
    throw new Error("blocked call")
  }

  const paramName = getIdentifierName(params[0])

  if (!isAstNode(arrowNode.body)) {
    throw new Error("blocked call")
  }

  return (value: TemplateValue) =>
    evaluateNode({
      node: arrowNode.body,
      scope: {
        ...scope,
        [paramName]: value,
      },
    })
}

const evaluateArrayMethod = ({
  target,
  methodName,
  args,
  scope,
}: {
  target: TemplateValue[]
  methodName: string
  args: unknown[]
  scope: EvaluationScope
}): TemplateValue => {
  if (!allowedArrayMethods.has(methodName)) {
    throw new Error(`blocked call: ${methodName}`)
  }

  if (target.length > maxArrayIterationLength) {
    throw new Error("array iteration limit exceeded")
  }

  if (methodName === "join") {
    const separator =
      args[0] === undefined ? "," : toStringValue(evaluateNode({ node: args[0], scope }))

    const value = target.map((item) => toStringValue(item)).join(separator)
    assertOutputLength(value)
    return value
  }

  if (methodName === "slice") {
    const evaluatedArgs = args.map((argument) => evaluateNode({ node: argument, scope }))

    return target.slice(
      toInteger(evaluatedArgs[0], 0),
      evaluatedArgs[1] === undefined ? undefined : toInteger(evaluatedArgs[1], 0),
    )
  }

  if (!isAstNode(args[0]) || args[0].type !== "ArrowFunctionExpression") {
    throw new Error("blocked call")
  }

  const evaluateArrow = createArrowFunctionEvaluator({
    arrowNode: args[0],
    scope,
  })

  if (methodName === "map") {
    return target.map((value) => evaluateArrow(value))
  }

  return target.filter((value) => evaluateArrow(value))
}

const evaluateStringMethod = ({
  target,
  methodName,
  args,
  scope,
}: {
  target: string
  methodName: string
  args: unknown[]
  scope: EvaluationScope
}): TemplateValue => {
  if (!allowedStringMethods.has(methodName)) {
    throw new Error(`blocked call: ${methodName}`)
  }

  const evaluatedArgs = args.map((argument) => evaluateNode({ node: argument, scope }))

  if (methodName === "trim") {
    return target.trim()
  }

  if (methodName === "replace") {
    return target.replace(
      toStringValue(evaluatedArgs[0] ?? ""),
      toStringValue(evaluatedArgs[1] ?? ""),
    )
  }

  if (methodName === "repeat") {
    return target.repeat(Math.max(0, Math.min(toInteger(evaluatedArgs[0], 0), 1_000)))
  }

  if (methodName === "split") {
    return target.split(toStringValue(evaluatedArgs[0] ?? ""))
  }

  if (methodName === "toLowerCase") {
    return target.toLowerCase()
  }

  return target.toUpperCase()
}

const evaluatePropertyName = ({
  propertyNode,
  computed,
  scope,
}: {
  propertyNode: unknown
  computed: boolean
  scope: EvaluationScope
}) => {
  if (!computed) {
    return getIdentifierName(propertyNode)
  }

  return toStringValue(evaluateNode({ node: propertyNode, scope }))
}

const evaluateCallExpression = ({
  node,
  scope,
}: {
  node: AstNode
  scope: EvaluationScope
}): TemplateValue => {
  if (!isAstNode(node.callee) || node.callee.type !== "MemberExpression") {
    throw new Error("blocked call")
  }

  const callee = node.callee
  const methodName = evaluatePropertyName({
    propertyNode: callee.property,
    computed: callee.computed === true,
    scope,
  })
  assertPropertyAllowed(methodName)

  let target: TemplateValue

  try {
    target = evaluateNode({
      node: callee.object,
      scope,
    })
  } catch (error) {
    if (error instanceof Error && /^missing (identifier|property):/.test(error.message)) {
      throw new Error(`blocked call: ${methodName}`)
    }

    throw error
  }
  const args = Array.isArray(node.arguments) ? node.arguments : []

  if (typeof target === "string") {
    return evaluateStringMethod({
      target,
      methodName,
      args,
      scope,
    })
  }

  if (Array.isArray(target)) {
    return evaluateArrayMethod({
      target,
      methodName,
      args,
      scope,
    })
  }

  throw new Error(`blocked call: ${methodName}`)
}

const evaluateNode = ({
  node,
  scope,
  missingAsUndefined = false,
  depth = 0,
}: {
  node: unknown
  scope: EvaluationScope
  missingAsUndefined?: boolean
  depth?: number
}): TemplateValue => {
  if (depth > maxEvaluationDepth) {
    throw new Error("expression depth limit exceeded")
  }

  const nextDepth = depth + 1

  if (!isAstNode(node)) {
    throw new Error("unsupported expression")
  }

  switch (node.type) {
    case "ParenthesizedExpression":
    case "ChainExpression":
      return evaluateNode({
        node: node.expression,
        scope,
        missingAsUndefined,
        depth: nextDepth,
      })
    case "Identifier": {
      const name = getIdentifierName(node)

      if (blockedIdentifiers.has(name)) {
        throw new Error(`blocked identifier: ${name}`)
      }

      if (!(name in scope)) {
        if (missingAsUndefined) {
          return undefined
        }

        throw new Error(`missing identifier: ${name}`)
      }

      return scope[name]
    }
    case "Literal":
      return getLiteralValue(node)
    case "TemplateLiteral": {
      const quasis = Array.isArray(node.quasis) ? node.quasis : []
      const expressions = Array.isArray(node.expressions) ? node.expressions : []

      return quasis.reduce((text, quasi, index) => {
        const quasiValue = isAstNode(quasi) ? quasi.value : undefined

        if (!isPlainObject(quasiValue as TemplateValue)) {
          throw new Error("unsupported expression")
        }

        const cooked = (quasiValue as PlainObject).cooked

        if (typeof cooked !== "string") {
          throw new Error("unsupported expression")
        }

        const expressionValue =
          index < expressions.length
            ? toStringValue(evaluateNode({ node: expressions[index], scope, depth: nextDepth }))
            : ""

        const nextText = `${text}${cooked}${expressionValue}`
        assertOutputLength(nextText)
        return nextText
      }, "")
    }
    case "MemberExpression": {
      const target = evaluateNode({
        node: node.object,
        scope,
        missingAsUndefined,
        depth: nextDepth,
      })
      const propertyName = evaluatePropertyName({
        propertyNode: node.property,
        computed: node.computed === true,
        scope,
      })

      return getProperty({
        target,
        propertyName,
        missingAsUndefined,
      })
    }
    case "BinaryExpression": {
      const left = evaluateNode({ node: node.left, scope, depth: nextDepth })
      const right = evaluateNode({ node: node.right, scope, depth: nextDepth })
      const operator = node.operator

      if (operator === "+") {
        if (typeof left === "string" || typeof right === "string") {
          const value = `${toStringValue(left)}${toStringValue(right)}`
          assertOutputLength(value)
          return value
        }

        if (typeof left === "number" && typeof right === "number") {
          return left + right
        }
      }

      if (typeof left === "number" && typeof right === "number") {
        if (operator === "-") {
          return left - right
        }
        if (operator === "*") {
          return left * right
        }
        if (operator === "/") {
          return left / right
        }
        if (operator === "%") {
          return left % right
        }
      }

      if (operator === "===") {
        return left === right
      }
      if (operator === "!==") {
        return left !== right
      }
      if (operator === "==" || operator === "!=") {
        throw new Error("unsupported expression")
      }

      if (isScalarValue(left) && isScalarValue(right)) {
        if (operator === ">") {
          return left > right
        }
        if (operator === ">=") {
          return left >= right
        }
        if (operator === "<") {
          return left < right
        }
        if (operator === "<=") {
          return left <= right
        }
      }

      throw new Error("unsupported expression")
    }
    case "LogicalExpression": {
      const operator = node.operator

      if (operator === "??") {
        const left = evaluateNode({
          node: node.left,
          scope,
          missingAsUndefined: true,
          depth: nextDepth,
        })

        return left === null || left === undefined
          ? evaluateNode({ node: node.right, scope, depth: nextDepth })
          : left
      }

      const left = evaluateNode({
        node: node.left,
        scope,
        depth: nextDepth,
      })

      if (operator === "&&") {
        return left ? evaluateNode({ node: node.right, scope, depth: nextDepth }) : left
      }

      if (operator === "||") {
        return left || evaluateNode({ node: node.right, scope, depth: nextDepth })
      }

      throw new Error("unsupported expression")
    }
    case "ConditionalExpression":
      return evaluateNode({ node: node.test, scope, depth: nextDepth })
        ? evaluateNode({ node: node.consequent, scope, depth: nextDepth })
        : evaluateNode({ node: node.alternate, scope, depth: nextDepth })
    case "CallExpression":
      return evaluateCallExpression({
        node,
        scope,
      })
    default:
      throw new Error(`unsupported expression: ${node.type}`)
  }
}

// Evaluates a constrained expression against template props.
export const evaluateTemplateExpression = (
  expression: string,
  props: Record<string, TemplateValue>,
): string | number | boolean => {
  if (expression.length > maxExpressionLength) {
    throw new Error("expression length limit exceeded")
  }

  const parsed = parseSync("template-expression.ts", `(${expression})`, {
    sourceType: "script",
  })

  if (parsed.errors.length > 0) {
    throw new Error("unsupported expression")
  }

  const statement = parsed.program.body[0]

  if (!statement || statement.type !== "ExpressionStatement") {
    throw new Error("unsupported expression")
  }

  return toFinalValue(
    evaluateNode({
      node: statement.expression,
      scope: props,
    }),
  )
}
