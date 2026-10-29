import { type PropertyResearch } from '@renovagent/contracts';
export function PhotoReviewSummary({ research }: { research: PropertyResearch }) {
  const review = research.photoReview;
  if (!review) return null;
  const reviewed = review.photos.filter((p) => p.status === 'reviewed').length;
  return (
    <section className="photo-review-summary">
      <p className="eyebrow">MUSE / ATTACHED-IMAGE REVIEW</p>
      <h3>
        {reviewed} of {review.photos.length} photos inspected
      </h3>
      <p>
        {review.batches.length} image-attachment runs · unreviewed visual proposals. Room labels and
        questions come from Muse. Photos do not establish measurements, concealed services, present
        condition or code compliance.
      </p>
      {review.planning && (
        <details>
          <summary>
            {review.planning.questions.length} planning questions ·{' '}
            {review.planning.nextSteps.length} next steps from Muse
          </summary>
          <p>
            Planning synthesis from Muse’s own attached-image observations · {review.planning.model}{' '}
            · run {review.planning.runId}
          </p>
          <strong>Decisions and questions</strong>
          <ul>
            {review.planning.questions.map((question) => (
              <li key={question.text}>
                {question.text}
                <small>Photos: {question.photoIds.join(', ')}</small>
              </li>
            ))}
          </ul>
          <strong>Next steps</strong>
          <ol>
            {review.planning.nextSteps.map((step) => (
              <li key={step.text}>
                {step.text}
                <small>
                  {step.kind} · photos: {step.photoIds.join(', ')}
                </small>
              </li>
            ))}
          </ol>
        </details>
      )}
      <details>
        <summary>All photo identifications, questions &amp; next checks</summary>
        {review.photos.map((photo) => (
          <details key={photo.id} className="photo-review-entry">
            <summary>
              {photo.locator} · {photo.roomType} · {photo.confidence} confidence
              {photo.status === 'unreadable' ? ' · unreadable' : ''}
            </summary>
            <p>Raw image-review notes: {photo.observations.join(' ')}</p>
            {photo.uncertainties.length > 0 && <p>Uncertain: {photo.uncertainties.join(' ')}</p>}
            <strong>Planning questions</strong>
            <ul>
              {photo.questions.map((q) => (
                <li key={q}>
                  {q}
                  {!/[.!?]$/.test(q.trim()) && (
                    <em> · Incomplete raw output; see planning synthesis.</em>
                  )}
                </li>
              ))}
            </ul>
            <strong>Next checks</strong>
            <ul>
              {photo.nextSteps.map((q) => (
                <li key={q}>
                  {q}
                  {!/[.!?]$/.test(q.trim()) && (
                    <em> · Incomplete raw output; see planning synthesis.</em>
                  )}
                </li>
              ))}
            </ul>
            <a href={photo.imageUrl} target="_blank" rel="noreferrer">
              Open exact source photo ↗
            </a>
            <small>Input SHA-256: {photo.sha256}</small>
          </details>
        ))}
      </details>
      <details>
        <summary>Attachment provenance</summary>
        <p>Manifest SHA-256: {review.manifestHash}</p>
        <p>
          Completed: {review.reviewedAt}. Import metadata is not a qualified-review certificate.
        </p>
        {review.batches.map((batch) => (
          <p key={batch.runId}>
            {batch.model} · run {batch.runId} · {batch.photoIds.length} attached photos
          </p>
        ))}
      </details>
    </section>
  );
}
