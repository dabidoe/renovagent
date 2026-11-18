import { useRef, useState } from 'react';
import { lineTotalMinor } from '@renovagent/core';
import { BathReviewIcon } from './bath-review-icon.js';
import { BathScopeReview } from './bath-scope-review.js';
import './vanity-review.css';

const route = '#example/hutchinson-vanity';
const reviewedOn = 'November 16, 2026';
const revisions = [
  {
    id: 'r1',
    name: 'White freestanding',
    model: 'Glacier Bay GB24P2-WH',
    dimensions: '24.50 in W × 18.63 in D',
    amountMinor: 15900,
    url: 'https://www.homedepot.com/p/203486567',
    faucet: {
      name: 'Glacier Bay Aragon, chrome',
      model: 'HD67100W-6301',
      mount: '4 in. centerset',
      amountMinor: 3498,
      url: 'https://www.homedepot.com/p/321132023',
    },
    install: 'Set and secure the floor-standing cabinet in the existing location.',
    questions: [
      'Measure the clear opening, depth and usable space beside the toilet.',
      'Check existing drain and supply positions against the new cabinet.',
      'Confirm faucet fit and whether the existing faucet can be reused.',
    ],
  },
  {
    id: 'r2',
    name: 'Natural oak floating',
    model: 'DeerValley DV-1BV0268NW',
    dimensions: '24.02 in W × 18.31 in D',
    amountMinor: 41097,
    url: 'https://www.homedepot.com/p/331833458',
    faucet: {
      name: 'Glacier Bay Dorind, chrome',
      model: 'HD67108W-6001',
      mount: 'Single hole',
      amountMinor: 6400,
      url: 'https://www.homedepot.com/p/321630278',
    },
    install:
      'Verify wall support and mount the cabinet at an agreed height. Price backing and tile repair only if needed.',
    questions: [
      'Measure the clear opening and check drawer travel beside the toilet.',
      'Verify wall support at the mounting points before pricing installation.',
      'Check trap and supply clearance behind the drawers and below the floating cabinet. Price relocation only if necessary.',
      'Select a compatible single-hole faucet and review the exposed finish below the cabinet.',
    ],
  },
] as const;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (minor: number) => dollars.format(minor / 100);

export function VanityReview({
  hash,
  backHref = '#example-house',
}: {
  hash: string;
  backHref?: string | null;
}) {
  const [pathname, query] = hash.split('?');
  const tileSelection = new URLSearchParams(query).get('tile');
  const grayTile = tileSelection === 'gray';
  const tileQuery =
    tileSelection === 'gray' || tileSelection === 'ivory' ? '?tile=' + tileSelection : '';
  const showScope = pathname.endsWith('/scope');
  const revised = pathname.split('/')[2] === 'r2';
  const selection = revisions[revised ? 1 : 0];
  const [copyStatus, setCopyStatus] = useState('');
  const detailDialog = useRef<HTMLDialogElement>(null);
  const swapDialog = useRef<HTMLDialogElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const total = lineTotalMinor(1, selection.amountMinor);
  const difference = total - lineTotalMinor(1, revisions[0].amountMinor);
  const revisionAddress = new URL(window.location.href);
  revisionAddress.hash = pathname + tileQuery;

  const reviewHref = route + '/' + selection.id;

  async function copyRevision() {
    try {
      await navigator.clipboard.writeText(revisionAddress.href);
      setCopyStatus('Revision link copied.');
    } catch {
      setCopyStatus('Copy the revision link from the field below.');
    }
  }

  return (
    <main className="vanity-review">
      <header className="vanity-heading">
        <div>
          {backHref && (
            <a className="vanity-back" href={showScope ? reviewHref + tileQuery : backHref}>
              {showScope ? '‹ Full bath' : '‹ Hutchinson'}
            </a>
          )}
          <h1>{showScope ? 'Scope' : 'Full bath'}</h1>
        </div>
        <div className="vanity-actions">
          <button
            type="button"
            aria-label="Materials and installation"
            title="Materials and installation"
            onClick={() => detailDialog.current?.showModal()}
          >
            <BathReviewIcon name="scope" />
          </button>
          <button
            type="button"
            aria-label="Share"
            title="Share"
            onClick={() => shareDialog.current?.showModal()}
          >
            <BathReviewIcon name="share" />
          </button>
        </div>
      </header>

      <BathScopeReview
        vanityMinor={total}
        vanityName={selection.name}
        revised={revised}
        difference={difference}
        showScope={showScope}
        scopeHref={reviewHref + '/scope' + tileQuery}
        grayTile={grayTile}
        focusFloor={Boolean(tileQuery)}
        floorSwapHref={reviewHref + (grayTile ? '?tile=gray' : '')}
        vanitySource={selection.url}
        vanityModel={selection.model}
        installNote={selection.install}
        vanityPicker={
          <button
            type="button"
            className="bath-swap"
            onClick={() => swapDialog.current?.showModal()}
          >
            Swap <BathReviewIcon name="concept" />
          </button>
        }
      />

      <dialog className="vanity-dialog" ref={swapDialog} aria-labelledby="bath-swap-title">
        <header className="vanity-dialog-head">
          <h2 id="bath-swap-title">Swap vanity</h2>
          <form method="dialog">
            <button type="submit" aria-label="Close swap">
              ×
            </button>
          </form>
        </header>
        <div className="bath-choice-list">
          {revisions.map((revision) => (
            <a
              key={revision.id}
              href={route + '/' + revision.id + tileQuery}
              aria-current={revision.id === selection.id ? 'page' : undefined}
              onClick={() => swapDialog.current?.close()}
            >
              <span>
                <strong>{revision.name}</strong>
                <small>{revision.dimensions}</small>
              </span>
              <strong>{money(revision.amountMinor)}</strong>
            </a>
          ))}
          <a href="https://www.homedepot.com/p/340242913" target="_blank" rel="noreferrer">
            <span>
              <strong>Caramel oak Faris</strong>
              <small>Retail alternative</small>
            </span>
            <strong>$249.00 ↗</strong>
          </a>
        </div>
      </dialog>

      <dialog className="vanity-dialog" ref={detailDialog} aria-labelledby="bath-details-title">
        <header className="vanity-dialog-head">
          <h2 id="bath-details-title">Vanity details</h2>
          <form method="dialog">
            <button type="submit" aria-label="Close details">
              ×
            </button>
          </form>
        </header>
        <details className="vanity-card">
          <summary>Install checks</summary>
          <p>{selection.install}</p>
          <ul>
            <li>Remove the existing vanity and sink. Keep the toilet, tub, mirror and light.</li>
            <li>Reconnect and test the sink. Confirm connection parts before ordering.</li>
            {selection.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <p className="vanity-note">Removal and installation need a contractor quote.</p>
        </details>

        <details className="vanity-card vanity-sourcing">
          <summary>Materials</summary>
          <dl className="vanity-lines">
            <div>
              <dt>
                <a href={selection.url} target="_blank" rel="noreferrer">
                  {selection.model}
                </a>{' '}
                · Vanity and sink · {selection.dimensions}
              </dt>
              <dd>{money(total)}</dd>
            </div>
            <div>
              <dt>
                <a href={selection.faucet.url} target="_blank" rel="noreferrer">
                  {selection.faucet.name}
                </a>{' '}
                · {selection.faucet.model} · {selection.faucet.mount}
              </dt>
              <dd>{money(selection.faucet.amountMinor)}</dd>
            </div>
            <div>
              <dt>Vanity and faucet if selected</dt>
              <dd>{money(total + selection.faucet.amountMinor)}</dd>
            </div>
          </dl>
          <p className="vanity-note">
            Candidate faucet is separate from the draft budget. Confirm fit and drain clearance.
            Advertised prices checked {reviewedOn}.
          </p>
          <h3>Caramel oak alternative</h3>
          <p className="vanity-note">
            Warm wood with a floor-standing cabinet. Check the 19 in. depth and allow for assembly.{' '}
            <a href="https://www.homedepot.com/p/340242913" target="_blank" rel="noreferrer">
              Glacier Bay Faris · 24 in. W × 19 in. D · $249.00
            </a>
          </p>
        </details>
      </dialog>
      <dialog className="vanity-dialog" ref={shareDialog} aria-labelledby="bath-share-title">
        <header className="vanity-dialog-head">
          <h2 id="bath-share-title">Share revision</h2>
          <form method="dialog">
            <button type="submit" aria-label="Close share">
              ×
            </button>
          </form>
        </header>
        <div className="vanity-copy">
          <input
            aria-label="Revision link"
            value={revisionAddress.href}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" onClick={() => void copyRevision()}>
            Copy link
          </button>
          <span role="status">{copyStatus}</span>
        </div>
      </dialog>
    </main>
  );
}
