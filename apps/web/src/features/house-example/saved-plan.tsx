import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { PaintFloorStudio } from './paint-floor-studio.js';
import type { HouseProject } from './paint-floor.js';
import { SignInChoices } from '../connect/sign-in.js';
import '../connect/connect-agent.css';

// A paint-and-floor plan an owner's agent saved (MCP save_plan), opened from
// the link the agent gave: the rooms in 3D with the agent's picks, ready to
// change. Changes stay in this browser; the saved plan is the agent's proposal.

type Loaded = { title: string; agent: string; createdAt: string; project: HouseProject };

export function SavedPlan({ id }: { id: string }) {
  const [plan, setPlan] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<{ signIn: string[] } | { message: string } | null>(null);
  useEffect(() => {
    let live = true;
    (workspaceRequest(`/studio-plans/${id}`) as Promise<Loaded>)
      .then((p) => live && setPlan(p))
      .catch(async (e: { code?: string; message?: string }) => {
        if (!live) return;
        if (e.code === 'FORBIDDEN' || e.code === 'UNAUTHORIZED') {
          const session = (await workspaceRequest('/session').catch(() => ({}))) as {
            providers?: string[];
          };
          setProblem({ signIn: session.providers?.length ? session.providers : ['google'] });
        } else setProblem({ message: e.message || 'This plan could not be opened.' });
      });
    return () => {
      live = false;
    };
  }, [id]);
  if (problem)
    return (
      <section className="ca" aria-label="Saved plan">
        <p className="ca-kicker">Saved plan</p>
        {'signIn' in problem ? (
          <>
            <h1>Sign in to open this plan.</h1>
            <p className="ca-sub">
              Your agent saved it to your Renovagent account. Sign in with the account you connected
              it to (a guest plan opens in the browser where the guest started).
            </p>
            <div className="ca-make">
              <SignInChoices providers={problem.signIn} className="ca-primary" />
            </div>
          </>
        ) : (
          <>
            <h1>This plan isn’t in your account.</h1>
            <p className="ca-sub">
              Plans open only for the account whose agent saved them. {problem.message}
            </p>
          </>
        )}
      </section>
    );
  if (!plan) return <p className="ca-sub">Opening the plan…</p>;
  const day = new Date(plan.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return (
    <PaintFloorStudio
      project={plan.project}
      kicker={`Proposed by ${plan.agent} · ${day}`}
      sources={
        <ul>
          <li>
            Choices: proposed by {plan.agent}, your connected agent. Change anything here; your
            changes stay in this browser.
          </li>
          <li>Prices: example prices for this demo, not live offers. Labour is not included.</li>
        </ul>
      }
    />
  );
}
