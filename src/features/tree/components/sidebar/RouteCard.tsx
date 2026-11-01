/** Tree sidebar, bottom card: route mode — the cheapest cost between two nodes. */
import type { Route, TreeNode } from "@/features/tree/types";
import { Fact } from "@/ui";

export function RouteCard({ active, picks, route, onStart, onStop }: {
  active: boolean; picks: TreeNode[]; route: Route | null; onStart: () => void; onStop: () => void;
}) {
  let body: JSX.Element | null = null;
  if (active && picks.length === 0) body = <p className="note">Click a start node on the map, then a target.</p>;
  else if (active && picks.length === 1) body = <p className="note">From <b>{picks[0].name}</b>. Now click the target.</p>;
  else if (active && !route) body = <p className="reason">No path between {picks[0].name} and {picks[1].name}.</p>;
  else if (active && route) {
    const main = route.steps.filter(x => !x.isRequirement), reqs = route.steps.filter(x => x.isRequirement);
    body = (
      <>
        <div className="route-cost">{route.cost} <small>points</small></div>
        <div>{picks[0].name} → {picks[1].name}</div>
        <dl className="facts">
          <dt>Path</dt><dd>{main.reduce((t, x) => t + x.cost, 0)} pts</dd>
          {reqs.map(x => (
            <Fact key={x.target.id} label={`+ ${x.target.name}`}>
              {x.cost} pts {x.requiredBy && <span className="mono">(required by {x.requiredBy.name})</span>}
            </Fact>
          ))}
        </dl>
        {route.steps.map((x, i) => <p key={i} className="path">{x.isRequirement ? "req: " : ""}{x.path.map(n => n.id).join(" → ")}</p>)}
      </>
    );
  }
  return (
    <section className="card">
      <h2>Route</h2>
      {!active && <p className="note" style={{ marginTop: 0 }}>Measure the cheapest path between two nodes, including every parent 2 it needs.</p>}
      {body}
      <button className={`btn${active ? "" : " primary"}`} style={{ marginTop: 10 }} onClick={active ? onStop : onStart}>
        {active ? "Exit route mode" : "Start route mode"}
      </button>
    </section>
  );
}
