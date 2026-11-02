// Keep the API's safe diagnostics intact, but out of the main demo flow.
export function studioErrorSummary(message: string) {
  if (/sign in|signed out|unauthorized/i.test(message)) return 'Please sign in to continue.';
  if (/fetch|network|connection|unreachable/i.test(message))
    return 'Could not connect. Please try again.';
  if (/provider|service|endpoint|model|upstream|timeout|timed out/i.test(message))
    return 'The preview service is unavailable right now.';
  return 'This action could not be completed.';
}

export function StudioError({
  message,
  className = 'pf-intake-error',
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={`pf-studio-error ${className}`} role="alert">
      <span>{studioErrorSummary(message)}</span>
      <details>
        <summary>Details</summary>
        <div>{message}</div>
      </details>
    </div>
  );
}
