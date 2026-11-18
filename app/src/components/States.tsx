import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, ArrowLeft } from "lucide-react";
import s from "../styles/App.module.css";
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <Info size={24} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Pending({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children?: ReactNode;
}) {
  return (
    <section className={s.reading}>
      <Link to="/" className={s.back}>
        <ArrowLeft size={16} /> 返回首页
      </Link>
      <span className={s.eyebrow}>开发阶段 · {phase}</span>
      <h1>{title}</h1>
      <EmptyState title="此功能尚未开放">
        {children ||
          "本阶段已预留路由，内容将在后续开发阶段完成，当前没有可进入的课程。"}
      </EmptyState>
      <Link to="/projects" className={s.button}>
        查找已登记项目
      </Link>
    </section>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className={s.reading}>
        <EmptyState title="页面未能正常显示">
          请刷新重试；如问题持续，请检查构建文件完整性。
        </EmptyState>
        <a href="/">重新打开首页</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
