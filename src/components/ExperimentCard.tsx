import type { ReactNode } from "react";
import type { Experiment } from "../domain/types";
import { StreamTag } from "./StreamTag";

export function ExperimentCard({
  experiment,
  selected = false,
  children,
}: {
  experiment: Experiment;
  selected?: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      className={`exp-card stream-${experiment.stream}${selected ? " is-selected" : ""}`}
      aria-label={experiment.name}
    >
      <div className="exp-card-meta">
        <StreamTag stream={experiment.stream} />
        {experiment.portable && <span className="badge">Portable</span>}
      </div>
      <h3 className="exp-card-name">{experiment.name}</h3>
      <p className="exp-card-do">{experiment.do}</p>
      <dl className="exp-card-facts">
        <div>
          <dt>Tests</dt>
          <dd>{experiment.tests}</dd>
        </div>
        <div>
          <dt>Minimum</dt>
          <dd>{experiment.unit}</dd>
        </div>
      </dl>
      {experiment.source && <p className="exp-card-source">Source: {experiment.source}</p>}
      {children && <div className="exp-card-actions">{children}</div>}
    </article>
  );
}
