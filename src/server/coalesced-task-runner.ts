type TaskRunner = (key: string) => Promise<void>

type TaskState = {
  inFlight: boolean
  rerun: boolean
  promise: Promise<void> | null
}

export const createCoalescedTaskRunner = ({
  run,
}: {
  run: TaskRunner
}) => {
  const states = new Map<string, TaskState>()

  const schedule = (key: string) => {
    const state = states.get(key) ?? {
      inFlight: false,
      rerun: false,
      promise: null,
    }

    states.set(key, state)

    if (state.inFlight) {
      state.rerun = true
      return state.promise ?? Promise.resolve()
    }

    state.inFlight = true
    state.rerun = false
    state.promise = (async () => {
      do {
        state.rerun = false
        await run(key)
      } while (state.rerun)
    })().finally(() => {
      state.inFlight = false
      state.promise = null

      if (!state.rerun) {
        states.delete(key)
      }
    })

    return state.promise
  }

  return {
    schedule,
    flush: schedule,
  }
}
