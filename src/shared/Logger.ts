import { AsyncLocalStorage } from "node:async_hooks"

type LogSink = (message: string) => void

const logStorage = new AsyncLocalStorage<LogSink>()

export const runWithLogSink = <Result>(sink: LogSink, task: () => Result) =>
  logStorage.run(sink, task)

export const log = (message: string) => {
  logStorage.getStore()?.(message)
}
