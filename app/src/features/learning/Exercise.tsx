import { useProgress } from "../progress/ProgressProvider";
import { useState } from "react";
import type { ReadyStep } from "./content";
import s from "../../styles/Laboratory.module.css";
export function Exercise({
  step,
  progressKey,
}: {
  step: ReadyStep;
  progressKey: string;
}) {
  const { data, change } = useProgress();
  const [answer, setAnswer] = useState("");
  const record = data?.stepStates[progressKey];
  const review =
    record?.selfReview === "explained"
      ? "我能解释"
      : record?.selfReview === "practice"
        ? "还需练习"
        : "";
  return (
    <section className={s.exercise}>
      <h3>思考与自评</h3>
      <p>{step.exercise.prompt}</p>
      <label className={s.answerLabel}>
        本步练习回答
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          placeholder="写下你的推理、口径与限制…"
        />
      </label>
      <p className={s.caption}>
        回答仅在本步页面临时保留；离开步骤会清空。自评状态持久保存，不自动判卷；练习文字不在备份范围。
      </p>
      <details>
        <summary>查看提示与核对清单</summary>
        <p>{step.exercise.hint}</p>
        <ul>
          {step.exercise.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      <fieldset>
        <legend>你的自评</legend>
        {["还需练习", "我能解释"].map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={"self-review-" + step.id}
              value={value}
              checked={review === value}
              onChange={() =>
                change(
                  progressKey,
                  undefined,
                  value === "我能解释" ? "explained" : "practice",
                )
              }
            />
            {value}
          </label>
        ))}
      </fieldset>
      {review && (
        <p role="status">
          自评：{review}。属于自我确认，不是考试评分；请再主动标记完成。
        </p>
      )}
      <p className={s.caption}>{step.exercise.provenance}</p>
    </section>
  );
}
