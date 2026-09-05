/**
 * The three states any query can be in, in one place so that eighteen pages
 * do not each write the same three branches.
 *
 * The loading state is a shaped skeleton rather than a spinner. The database
 * is already in memory by the time a page renders — these waits are
 * milliseconds, and a skeleton that holds the layout stops the page jumping
 * when the answer lands.
 */
export function Skeleton({ rows = 6, height = 34 }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      <div className="skeleton" style={{ height, borderRadius: 0 }} />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: height - 6, borderRadius: 0, opacity: 1 - i * 0.1 }}
        />
      ))}
    </div>
  )
}

export function Loading({ label = 'Querying the database' }) {
  return (
    <p className="state" role="status">
      {label}…
    </p>
  )
}

export function ErrorBox({ error, context }) {
  return (
    <div className="error" role="alert">
      <strong>{context ?? 'The query failed'}</strong>
      <pre>{String(error?.message ?? error)}</pre>
    </div>
  )
}

export function Empty({ children = 'Nothing recorded.' }) {
  return <p className="state">{children}</p>
}

/**
 * Render children only once a query has resolved.
 *
 *     <Result state={state} skeleton>{(data) => <DataTable data={data} />}</Result>
 */
export function Result({ state, context, skeleton = false, rows = 6, children }) {
  if (state.loading) return skeleton ? <Skeleton rows={rows} /> : <Loading />
  if (state.error) return <ErrorBox error={state.error} context={context} />
  return children(state.data)
}
