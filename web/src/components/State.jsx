/**
 * The three states every page can be in. The first query of a session waits
 * on a 1.6 MB download and a wasm instantiation, so the loading state says
 * what it is waiting for rather than showing a bare spinner.
 */
export function Loading({ what = 'Querying' }) {
  return (
    <p className="muted loading" role="status">
      {what}…
    </p>
  )
}

export function ErrorBox({ error, context }) {
  return (
    <div className="error" role="alert">
      <strong>{context ?? 'Query failed'}</strong>
      <pre>{String(error?.message ?? error)}</pre>
    </div>
  )
}

/**
 * Wraps the { loading, error, data } from useQuery so a page does not repeat
 * the same three branches.
 */
export function Result({ state, what, context, children }) {
  if (state.loading) return <Loading what={what} />
  if (state.error) return <ErrorBox error={state.error} context={context} />
  return children(state.data)
}
