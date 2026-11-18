import { ProgressPage } from "./features/progress/ProgressViews";
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ChartNoAxesCombined,
  Search,
  Settings,
  ArrowUpRight,
  WifiOff,
} from "lucide-react";
import { loadCatalog, type Catalog } from "./content/catalog";
import { EmptyState, Pending } from "./components/States";
import { Home, SettingsPage } from "./pages/Pages";
import { ProjectDirectory, CategoryPage } from "./pages/LibraryPages";
import { ProjectPage, DictionaryPage, SourcesPage } from "./pages/ProjectPages";
import { RoadmapPage, KnowledgePage } from "./pages/RoadmapPages";
import LaboratoryPage from "./pages/LaboratoryPage";
import s from "./styles/App.module.css";
export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch((e) => setError(e instanceof Error ? e.message : "目录读取失败"));
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const heading = document.querySelector("main h1");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [location.pathname]);
  return (
    <>
      <a
        className={s.skip}
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        跳转到主要内容
      </a>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link
            to="/"
            className={s.brand}
            aria-label="数据分析项目学习平台 首页"
          >
            <span className={s.brandIcon}>
              <ChartNoAxesCombined size={22} />
            </span>
            <span>
              数据分析<span className={s.brandSub}>项目学习平台</span>
            </span>
          </Link>
          <nav aria-label="全站导航" className={s.nav}>
            {[
              ["/", "首页"],
              ["/roadmap", "学习路线"],
              ["/projects", "项目库"],
              ["/knowledge", "知识索引"],
              ["/progress", "学习记录"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                end={to === "/"}
                to={to}
                className={({ isActive }) => (isActive ? s.active : undefined)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className={s.headerTools}>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/projects?q=" + encodeURIComponent(query));
              }}
              className={s.headerSearch}
            >
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="全站项目搜索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索项目或知识点"
              />
              <button aria-label="提交搜索" type="submit">
                <ArrowUpRight size={16} />
              </button>
            </form>
            <Link to="/settings" aria-label="设置" className={s.settingsLink}>
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={s.main}>
        {error ? (
          <EmptyState title="项目目录暂时无法加载">
            {error}。请确认 content/catalog.json 存在，重新构建后刷新。
          </EmptyState>
        ) : !catalog ? (
          <p role="status">正在读取本地项目目录…</p>
        ) : (
          <Routes>
            <Route path="/" element={<Home catalog={catalog} />} />
            <Route
              path="/projects"
              element={<ProjectDirectory catalog={catalog} />}
            />
            <Route
              path="/categories/:categoryId"
              element={<CategoryPage catalog={catalog} />}
            />
            <Route
              path="/projects/:projectId"
              element={<ProjectPage catalog={catalog} />}
            />
            <Route
              path="/projects/:projectId/lessons/:lessonId/steps/:stepId"
              element={<LaboratoryPage catalog={catalog} />}
            />
            <Route
              path="/projects/:projectId/dictionary"
              element={<DictionaryPage catalog={catalog} />}
            />
            <Route
              path="/projects/:projectId/sources"
              element={<SourcesPage catalog={catalog} />}
            />
            <Route
              path="/projects/:projectId/lessons/:lessonId"
              element={<LaboratoryPage catalog={catalog} />}
            />
            <Route
              path="/roadmap"
              element={<RoadmapPage catalog={catalog} />}
            />
            <Route
              path="/knowledge/:tagId?"
              element={<KnowledgePage catalog={catalog} />}
            />
            <Route path="/progress" element={<ProgressPage />} />
            <Route
              path="/settings"
              element={<SettingsPage catalog={catalog} />}
            />
            <Route
              path="*"
              element={
                <section className={s.reading}>
                  <EmptyState title="没有找到这个页面">
                    地址可能有误，或内容尚未开放。请返回首页或搜索项目。
                  </EmptyState>
                  <Link className={s.button} to="/">
                    返回首页
                  </Link>
                </section>
              }
            />
          </Routes>
        )}
      </main>
      <footer className={s.footer}>
        <span>
          <ChartNoAxesCombined size={16} /> 数据分析项目学习平台
        </span>
        <span>
          <WifiOff size={14} /> 本机运行 · 离线优先 · 内容版本{" "}
          {catalog?.contentVersion || "0.4.0"}
        </span>
        <Link to="/settings">阅读设置</Link>
      </footer>
    </>
  );
}
