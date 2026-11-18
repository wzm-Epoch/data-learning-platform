import { useState, useEffect, useRef } from "react";
import type { ReadyStep, CodeRef } from "./content";
import s from "../../styles/Laboratory.module.css";
function CodeBlock({
  code,
  label,
  onSource,
}: {
  code: string;
  label: string;
  onSource?: () => void;
}) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("已复制；请在新工程副本环境中审查后使用。");
    } catch {
      setMessage("无法访问剪贴板，请选择代码文本手动复制。");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([code], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "learning-code.py.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className={s.codeBlock}>
      <div className={s.codeHeader}>
        <strong>{label}</strong>
        <div>
          {onSource && <button onClick={onSource}>定位来源单元</button>}
          <button onClick={copy} aria-label={"复制" + label}>
            复制代码
          </button>
          <button onClick={download}>下载文本</button>
        </div>
      </div>
      <ol
        className={s.codeLines}
        tabIndex={0}
        aria-label={label + "，代码区可横向滚动"}
      >
        {code.split("\n").map((line, i) => (
          <li key={i}>
            <code>{line || " "}</code>
          </li>
        ))}
      </ol>
      <p role="status" className={s.copyStatus}>
        {message}
      </p>
    </div>
  );
}
export function CodeView({ step }: { step: ReadyStep }) {
  const [mode, setMode] = useState<"original" | "teaching">("original");
  const [source, setSource] = useState<CodeRef | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!source) return;
    const prior = document.activeElement as HTMLElement | null;
    const modal = dialogRef.current;
    if (!modal) return;
    modal.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSource(null);
      } else if (event.key === "Tab") {
        const controls = Array.from(
          modal.querySelectorAll<HTMLElement>('button,a[href],[tabindex="0"]'),
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    modal.addEventListener("keydown", trap);
    return () => {
      modal.removeEventListener("keydown", trap);
      prior?.focus();
    };
  }, [source]);

  return (
    <section>
      <div className={s.switches} aria-label="代码版本">
        <button
          onClick={() => setMode("original")}
          aria-pressed={mode === "original"}
        >
          原代码
        </button>
        <button
          onClick={() => setMode("teaching")}
          aria-pressed={mode === "teaching"}
        >
          教学补充 / 修正
        </button>
      </div>
      <p className={s.caption}>
        代码依赖原Notebook前序变量。网页仅展示和复制，不执行Python；原导出语句不会运行。
      </p>
      {mode === "original" ? (
        step.codeRefs.map((ref) => (
          <CodeBlock
            key={ref.cell}
            label={"原代码（单元 " + ref.cell + "）"}
            code={ref.code}
            onSource={() => setSource(ref)}
          />
        ))
      ) : (
        <>
          <p className={s.identity}>教学补充 / 修正，非原Notebook原文</p>
          <CodeBlock code={step.teachingCode} label="教学代码片段" />
        </>
      )}
      {source && (
        <div className={s.dialogBackdrop}>
          <section
            ref={dialogRef}
            className={s.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="原代码来源定位"
          >
            <button
              className={s.closeDialog}
              onClick={() => setSource(null)}
              autoFocus
            >
              关闭来源
            </button>
            <h3>原代码来源定位</h3>
            <p>{source.path}</p>
            <p>单元号：{source.cell}（从1开始）</p>
            <p className={s.hash}>Notebook SHA-256：{source.notebookSha256}</p>
            <p className={s.hash}>本单元源码 SHA-256：{source.codeSha256}</p>
            <p>
              此处只读定位，不会写回Notebook。原文件清单可在项目来源页查看。
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
