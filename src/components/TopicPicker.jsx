import { Check } from "lucide-react";
import { civicTopics } from "../data/demo";
import { useCivic } from "../context/CivicContext";

export default function TopicPicker({ title = "What issues matter to you?", condensed = false }) {
  const { topics, toggleTopic } = useCivic();
  return (
    <section className={`topic-picker ${condensed ? "condensed" : ""}`}>
      <div>
        <span className="eyebrow">Personalize your feed</span>
        <h2>{title}</h2>
        {!condensed && <p>Choose a few topics. Your selections stay on this device.</p>}
      </div>
      <div className="topic-options">
        {civicTopics.map((topic) => {
          const selected = topics.includes(topic);
          return (
            <button key={topic} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleTopic(topic)}>
              {selected && <Check size={15} />} {topic}
            </button>
          );
        })}
      </div>
    </section>
  );
}
