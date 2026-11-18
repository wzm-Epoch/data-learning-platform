import { useEffect, useState } from "react";
export function useResource<T>(key: string, loader: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: "" },
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setState({ key });
    loader()
      .then((data) => {
        if (current) setState({ key, data });
      })
      .catch((error) => {
        if (current)
          setState({
            key,
            error: error instanceof Error ? error.message : "资源加载失败",
          });
      });
    return () => {
      current = false;
    };
  }, [key, attempt]);
  return {
    ...(state.key === key ? state : {}),
    retry: () => setAttempt((x) => x + 1),
  };
}
