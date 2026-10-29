import { useState, useEffect, useRef, type FormEvent } from 'react';
import { type Workspace } from '@unpermitted/contracts';
import { photoQuestions, workLabels } from '@unpermitted/core';
import { WorkspaceController, projectRuns } from '../../app/workspace-controller.js';
import { Glyph } from '../../components/glyph.js';
export function Composer({
  controller,
  state,
  projectId,
  busy,
  notesOnly = false,
  compact = false,
  onSent,
  showQuestions = false,
  onOpenTools,
}: {
  controller: WorkspaceController;
  state: Workspace;
  projectId: string;
  busy: boolean;
  notesOnly?: boolean;
  compact?: boolean;
  onSent?: () => void;
  showQuestions?: boolean;
  onOpenTools?: () => void;
}) {
  const questions = notesOnly ? [] : photoQuestions(state, projectId);
  const savedReply = notesOnly ? undefined : state.drafts[projectId]?.photoReply;
  const [questionId, setQuestionId] = useState(
    savedReply
      ? `${savedReply.researchId}:r${savedReply.researchRevision}:question:${savedReply.questionIndex}`
      : '',
  );
  const [disposition, setDisposition] = useState<'direction' | 'unsure' | 'deferred'>(
    savedReply?.disposition || 'direction',
  );
  const question = questions.find((q) => q.id === questionId);
  const nextQuestion =
    questions.find((q) => !q.answer) ||
    questions.find(
      (q) =>
        q.answer?.payload.kind === 'photo-planning-answer' &&
        q.answer.payload.disposition !== 'direction',
    );
  const response = question?.answer?.payload;
  function chooseQuestion(id: string) {
    setQuestionId(id);
    setReply('');
    const q = questions.find((item) => item.id === id);
    const meaning =
      q?.answer?.payload.kind === 'photo-planning-answer'
        ? q.answer.payload.disposition
        : 'direction';
    setDisposition(meaning);
    void controller.saveDraft(
      projectId,
      text,
      draftIds,
      q
        ? {
            researchId: q.research.id,
            researchRevision: q.research.revision,
            questionIndex: q.index,
            expectedAnswerRevision: q.answer?.revision || 0,
            disposition: meaning,
          }
        : null,
    );
  }
  const initial = state.drafts[projectId];
  const [text, setText] = useState(initial?.text || '');
  const [error, setError] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const waiting = projectRuns(state, projectId).filter((r) => r.state === 'waiting_for_input');
  const [reply, setReply] = useState('');
  const draftIds = state.drafts[projectId]?.evidenceIds || [];
  useEffect(() => {
    if (waiting.length && !reply) setReply(waiting[0].id);
    else if (reply && !waiting.some((r) => r.id === reply)) setReply('');
  }, [waiting.map((r) => r.id).join('|')]);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (questionId && !question) return;
    if (question && (!question.current || !text.trim())) return;
    if ((!text.trim() && !draftIds.length) || busy || fileBusy) return;
    setError('');
    try {
      if (question) {
        await controller.answerPhotoQuestion(
          projectId,
          { kind: 'artifact', id: question.research.id, revision: question.research.revision },
          question.index,
          savedReply?.expectedAnswerRevision ?? question.answer?.revision ?? 0,
          text,
          disposition,
          draftIds,
        );
        setQuestionId('');
      } else if (reply)
        await controller.transition(
          projectId,
          reply,
          'answer',
          text.trim() || 'See the attached local references; other details are unknown.',
        );
      else await controller.sendMessage(projectId, text, draftIds);
      setText('');
      onSent?.();
    } catch {
      /* Controller preserves the unsent text and exposes the error. */
    }
  }
  async function attach(files: File[]) {
    setFileBusy(true);
    setError('');
    try {
      for (const file of files) await controller.attachFile(projectId, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFileBusy(false);
    }
  }
  return (
    <form
      className={`conversation-composer ${compact ? 'prompt-composer' : ''}`}
      onSubmit={send}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void attach([...e.dataTransfer.files]);
      }}
    >
      {questionId && !question && (
        <p role="alert">
          Your draft refers to an earlier Muse review. Select a current question to reconfirm it.
          <button type="button" onClick={() => chooseQuestion('')}>
            Use project conversation
          </button>
        </p>
      )}
      {questions.length > 0 && (!compact || showQuestions || questionId) && (
        <details
          className="photo-question-context"
          open={questionId || showQuestions ? true : undefined}
        >
          <summary>Questions from your photos</summary>
          <div className="photo-question-heading">
            <strong>From your listing photos</strong>
            <span>
              {
                questions.filter(
                  (q) =>
                    q.current &&
                    q.answer?.payload.kind === 'photo-planning-answer' &&
                    q.answer.payload.disposition === 'direction',
                ).length
              }
              /{questions.length} directions captured
            </span>
          </div>
          {questions.some((q) => !q.current) && (
            <p role="alert">
              The source review is stale. Earlier responses need reconfirmation after current
              research is imported.
            </p>
          )}
          <label>
            Conversation topic
            <select
              aria-label="Photo planning question"
              value={questionId}
              onChange={(e) => {
                chooseQuestion(e.target.value);
              }}
            >
              <option value="">Project conversation</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.index + 1}. {q.text} ·{' '}
                  {q.answer?.payload.kind === 'photo-planning-answer'
                    ? q.answer.payload.disposition === 'direction'
                      ? 'direction captured'
                      : q.answer.payload.disposition
                    : 'unanswered'}
                </option>
              ))}
            </select>
          </label>
          {!question && nextQuestion && (
            <button
              type="button"
              className="link-button"
              disabled={!nextQuestion.current}
              onClick={() => chooseQuestion(nextQuestion.id)}
            >
              Answer next: question {nextQuestion.index + 1}
            </button>
          )}
          {question && (
            <>
              <p className="photo-question-text">{question.text}</p>
              {!question.current && (
                <p role="alert">This review is stale. Import current research before answering.</p>
              )}
              {savedReply &&
                savedReply.expectedAnswerRevision !== (question.answer?.revision || 0) && (
                  <p role="alert">
                    A newer response was saved.{' '}
                    <button type="button" onClick={() => chooseQuestion(question.id)}>
                      Review current response and keep my draft
                    </button>
                  </p>
                )}
              {response?.kind === 'photo-planning-answer' && (
                <p>
                  Saved response r{question.answer!.revision}: {response.answer}{' '}
                  <small>Sending creates a new revision.</small>
                </p>
              )}
              <details>
                <summary>
                  Photo sources & uncertainty · Muse review r{question.research.revision}
                </summary>
                <p>
                  Muse visual interpretation; unreviewed. Listing photos may be dated. Your answer
                  records direction, not measured conditions or technical approval.
                </p>
                {question.photos.map((photo) => (
                  <div key={photo.id}>
                    <strong>
                      {photo.id} · {photo.roomType} · {photo.confidence} confidence
                    </strong>
                    <p>{photo.observations.join(' ')}</p>
                    <p>
                      Uncertain:{' '}
                      {photo.uncertainties.join(' ') ||
                        'Current condition, dimensions and concealed services remain unverified.'}
                    </p>
                    <a href={photo.imageUrl} target="_blank" rel="noreferrer">
                      Open source photo
                    </a>
                    {' · '}
                    <a href={photo.pageUrl} target="_blank" rel="noreferrer">
                      Listing source
                    </a>
                  </div>
                ))}
              </details>
              <label>
                Response meaning
                <select
                  aria-label="Response meaning"
                  value={disposition}
                  onChange={(e) => {
                    const value = e.target.value as typeof disposition;
                    setDisposition(value);
                    if (savedReply)
                      void controller.saveDraft(projectId, text, draftIds, {
                        ...savedReply,
                        disposition: value,
                      });
                  }}
                >
                  <option value="direction">My reported direction</option>
                  <option value="unsure">I’m not sure — keep open</option>
                  <option value="deferred">Defer — keep open</option>
                </select>
              </label>
              <p className="small-note">
                Save with the send button below. Measurements and qualified review stay open.
              </p>
            </>
          )}
        </details>
      )}
      {waiting.length > 0 && !question && (
        <label className="reply-context">
          Reply to
          <select
            aria-label="Reply context"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          >
            <option value="">Project conversation</option>
            {waiting.map((r) => (
              <option key={r.id} value={r.id}>
                {workLabels[r.kind]} · clarification
              </option>
            ))}
          </select>
        </label>
      )}
      {draftIds.map((id) => (
        <div className="draft-reference" key={id}>
          <Glyph name="file" />
          <span>{state.evidence[id]?.source.attachment?.name || 'Reference'}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove from draft"
            onClick={() =>
              void controller.saveDraft(
                projectId,
                text,
                draftIds.filter((v) => v !== id),
              )
            }
          >
            <Glyph name="close" />
          </button>
        </div>
      ))}
      <label className="sr-only" htmlFor="project-message">
        Your project message
      </label>
      <textarea
        id="project-message"
        value={text}
        maxLength={4000}
        placeholder={
          notesOnly
            ? 'Add a project note. No automated reply…'
            : question
              ? 'Your direction, or what you still need to find out…'
              : reply
                ? 'Add the missing detail, or say “unknown”…'
                : 'Describe an idea, add a detail, or share a photo…'
        }
        onChange={(e) => {
          setText(e.target.value);
          void controller.saveDraft(projectId, e.target.value, draftIds).catch(() => {});
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <div className="composer-controls">
        <div className="composer-attachments">
          <button
            type="button"
            className="link-button"
            onClick={() => input.current?.click()}
            disabled={fileBusy}
          >
            <Glyph name="plus" />
            {fileBusy ? 'Saving file…' : 'Photo or document'}
          </button>
          {onOpenTools && (
            <button type="button" className="link-button" onClick={onOpenTools}>
              <Glyph name="menu" />
              Tools
            </button>
          )}
        </div>
        <button
          className="send"
          type="submit"
          disabled={
            busy ||
            fileBusy ||
            Boolean(questionId && !question) ||
            (question ? !question.current || !text.trim() : !text.trim() && !draftIds.length)
          }
          aria-label="Send message"
        >
          <Glyph name="arrow" />
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            void attach([...(e.target.files || [])]);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!compact && (
        <p className="composer-note">
          {controller.connected
            ? 'Saved in your local Mongo workspace. Photo analysis is available in the house tools; messages do not run a live assistant.'
            : 'Saved on this device. Connect through the house tools to enable Muse photo analysis.'}
        </p>
      )}
    </form>
  );
}
