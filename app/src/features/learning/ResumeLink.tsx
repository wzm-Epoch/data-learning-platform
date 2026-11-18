import { useProgress } from "../progress/ProgressProvider";
import { Link } from "react-router-dom";
import { useResource } from "../../content/useResource";
import { loadLearningIndex, stepUrl } from "./content";
import a from "../../styles/App.module.css";
export function ResumeLink() {
  const { data } = useResource("learning-index", loadLearningIndex);
  const progress = useProgress();
  if (!data)
    return (
      <Link className={a.asideLink} to="/projects/P21/lessons/sales-explore">
        进入P21交易探索 →
      </Link>
    );
  const location = progress.data?.lastLocation;
  const error = "";
  const step = location
    ? data.projects
        .find((p) => p.id === location.projectId)
        ?.lessons.find((l) => l.id === location.lessonId)
        ?.steps.find((s) => s.id === location.stepId)
    : null;
  return (
    <>
      {error && <p className={a.caption}>{error}</p>}
      <Link
        className={a.asideLink}
        to={
          location
            ? stepUrl(location.projectId, location.lessonId, location.stepId)
            : "/projects/P21/lessons/sales-explore"
        }
      >
        {location
          ? "继续阅读 " + location.projectId + " · " + step?.title
          : "进入P21交易探索"}{" "}
        →
      </Link>
      {location && (
        <p className={a.caption}>仅恢复阅读位置，不表示课程已完成。</p>
      )}
    </>
  );
}
