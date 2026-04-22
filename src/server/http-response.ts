import path from "node:path"
import { readFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

export const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString("utf8")
}

export const sendJson = ({
  response,
  statusCode,
  body,
}: {
  response: ServerResponse
  statusCode: number
  body: unknown
}) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body))
}

export const sendText = ({
  response,
  statusCode,
  body,
}: {
  response: ServerResponse
  statusCode: number
  body: string
}) => {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  })
  response.end(body)
}

export const sendFile = async ({
  response,
  filePath,
}: {
  response: ServerResponse
  filePath: string
}) => {
  const extension = path.extname(filePath)
  const content = await readFile(filePath)

  response.writeHead(200, {
    "content-type": contentTypes[extension] ?? "text/plain; charset=utf-8",
  })
  response.end(content)
}

export const parseJsonBody = async <T>(request: IncomingMessage) => JSON.parse(await readBody(request)) as T

export const hasJsonContentType = (request: IncomingMessage) =>
  request.headers["content-type"]?.toLowerCase().startsWith("application/json") ?? false

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
