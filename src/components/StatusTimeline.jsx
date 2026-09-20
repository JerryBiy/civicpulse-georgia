import { Check } from "lucide-react";

const steps = ["Introduced", "Committee", "Chamber vote", "Governor", "Law"];

export default function StatusTimeline({ stage = 1 }) {
  return (
    <ol className="status-timeline" aria-label="Legislative progress">
      {steps.map((step, index) => {
        const number = index + 1;
        const complete = number < stage;
        const current = number === stage;
        return (
          <li key={step} className={complete ? "complete" : current ? "current" : ""} aria-current={current ? "step" : undefined}>
            <span className="timeline-marker">{complete ? <Check size={15} /> : number}</span>
            <span>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
