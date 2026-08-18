import { useEffect, useReducer, useState } from "react";

import { appNavigate } from "./app-navigation";
import { nav, navigationAdapter } from "./nav";

export function App() {
  /**
   * Navigation API current entry가 변경되면
   * React UI를 다시 렌더링한다.
   *
   * 나중에 nav-scope/react가 생기면
   * 이런 코드는 hook 내부로 숨길 수 있다.
   */
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  const [error, setError] = useState<string>();

  /**
   * 공유 URL처럼 scope metadata 없이
   * modal URL로 직접 진입한 경우,
   * synthetic anchor를 만드는 동안
   * modal 조작을 잠시 숨긴다.
   */
  const [isBootstrapping, setIsBootstrapping] = useState(() => {
    const location = readLocation();

    return location.modal && !nav.current();
  });

  useEffect(() => {
    return nav.subscribe(() => {
      rerender();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const location = readLocation();

      /**
       * 일반 페이지이거나 이미 scope가 있다면:
       *
       * - 정상적으로 modal을 열어서 들어온 경우
       * - reload로 scope가 복원된 경우
       * - browser Forward로 scope에 재진입한 경우
       *
       * 별도 처리가 필요 없다.
       */
      if (!location.modal || nav.current()) {
        if (!cancelled) {
          setIsBootstrapping(false);
        }

        return;
      }

      const modalUrl =
        window.location.pathname +
        window.location.search +
        window.location.hash;

      try {
        /**
         * 현재 deep-link entry:
         *
         * /?modal=true&step=2
         *
         * 를 modal의 background URL인
         * "/"로 replace한다.
         */
        await appNavigate("/", "replace");

        if (cancelled) {
          return;
        }

        /**
         * 이제 실제 "/" history entry를
         * modal scope의 anchor로 삼는다.
         */
        const scope = nav.begin({
          kind: "modal",
          label: "Example modal",
        });

        /**
         * 공유받았던 원래 modal URL을
         * 새 scope 내부 entry로 다시 push한다.
         *
         * 결과:
         *
         * /
         * └─ /?modal=true&step=2
         */
        await scope.push(modalUrl);
      } catch (cause) {
        if (!cancelled) {
          setError(getErrorMessage(cause));
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const location = readLocation();

  const scope = nav.current();

  const run = async (operation: () => Promise<unknown>) => {
    setError(undefined);

    try {
      await operation();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  };

  const openModal = async () => {
    const modalScope = nav.begin({
      kind: "modal",
      label: "Example modal",
    });

    await modalScope.push("/?modal=true");
  };

  const goToStep = async (step: number) => {
    const currentScope = nav.current();

    if (!currentScope) {
      throw new Error("No active modal scope.");
    }

    const search = new URLSearchParams();

    search.set("modal", "true");

    if (step > 1) {
      search.set("step", String(step));
    }

    await currentScope.push(`/?${search.toString()}`);
  };

  const backModal = async () => {
    const currentScope = nav.current();

    if (!currentScope) {
      throw new Error("No active modal scope.");
    }

    await currentScope.back();
  };

  const exitModal = async () => {
    const currentScope = nav.current();

    if (!currentScope) {
      throw new Error("No active modal scope.");
    }

    await currentScope.exit();
  };

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">nav-scope example</p>

        <h1>React modal navigation</h1>

        <p>
          Browser history는 그대로 유지하면서 modal 내부의 navigation을 하나의
          scope로 묶습니다.
        </p>
      </header>

      <section className="page">
        <h2>Main page</h2>

        <p>
          현재 URL: <code>{location.href}</code>
        </p>

        {!location.modal && (
          <button
            type="button"
            onClick={() => {
              void run(openModal);
            }}
          >
            Open modal
          </button>
        )}
      </section>

      <HistoryInspector />

      {isBootstrapping && (
        <section className="page">
          <p>Deep-link modal scope를 구성하는 중...</p>
        </section>
      )}

      {location.modal && !isBootstrapping && (
        <Modal
          step={location.step}
          scopeId={scope?.id}
          canBack={scope?.canBack ?? false}
          onBack={() => {
            void run(backModal);
          }}
          onNext={() => {
            void run(() => goToStep(location.step + 1));
          }}
          onExit={() => {
            void run(exitModal);
          }}
        />
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

interface ModalProps {
  readonly step: number;

  readonly scopeId: string | undefined;

  readonly canBack: boolean;

  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onExit: () => void;
}

function Modal({ step, scopeId, canBack, onBack, onNext, onExit }: ModalProps) {
  return (
    <div className="backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modalHeader">
          <div>
            <p className="eyebrow">navigation scope</p>

            <h2 id="modal-title">Modal step {step}</h2>
          </div>

          <button
            type="button"
            className="iconButton"
            aria-label="Exit modal"
            onClick={onExit}
          >
            ×
          </button>
        </header>

        <p>
          현재 modal scope: <code>{scopeId ?? "none"}</code>
        </p>

        <div className="steps">
          {[1, 2, 3].map((item) => (
            <span key={item} className={item === step ? "step active" : "step"}>
              {item}
            </span>
          ))}
        </div>

        <div className="modalBody">
          {step === 1 && (
            <>
              <h3>First step</h3>

              <p>Modal을 처음 연 history entry입니다.</p>
            </>
          )}

          {step === 2 && (
            <>
              <h3>Second step</h3>

              <p>같은 scope 내부의 다음 history entry입니다.</p>
            </>
          )}

          {step === 3 && (
            <>
              <h3>Third step</h3>

              <p>
                Exit을 누르면 중간 entry를 하나씩 거치지 않고 scope anchor로
                이동합니다.
              </p>
            </>
          )}
        </div>

        <footer className="modalFooter">
          <button type="button" disabled={!canBack} onClick={onBack}>
            Scope Back
          </button>

          {step < 3 && (
            <button type="button" onClick={onNext}>
              Next step
            </button>
          )}

          <button type="button" onClick={onExit}>
            Exit modal
          </button>
        </footer>
      </section>
    </div>
  );
}

function HistoryInspector() {
  const current = navigationAdapter.current();

  const entries = navigationAdapter.entries();

  return (
    <section className="inspector">
      <div className="inspectorHeader">
        <h2>Browser history</h2>

        <span>{entries.length} entries</span>
      </div>

      <ol className="history">
        {entries.map((entry) => {
          const isCurrent = entry.key === current.key;

          const url = entry.url ? formatUrl(entry.url) : "unknown";

          const scopes = entry.navScope?.scopes.map((scope) => scope.id) ?? [];

          return (
            <li
              key={entry.key}
              className={isCurrent ? "historyEntry current" : "historyEntry"}
            >
              <span className="historyIndex">{entry.index}</span>

              <div>
                <strong>{url}</strong>

                <div className="metadata">
                  {isCurrent && <span>current</span>}

                  {scopes.map((scope) => (
                    <code key={scope}>{scope.slice(0, 8)}</code>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function readLocation() {
  const url = new URL(window.location.href);

  const modal = url.searchParams.get("modal") === "true";

  const rawStep = Number(url.searchParams.get("step") ?? 1);

  const step = Number.isFinite(rawStep) ? Math.min(3, Math.max(1, rawStep)) : 1;

  return {
    href: url.pathname + url.search + url.hash,

    modal,
    step,
  };
}

function formatUrl(value: string): string {
  const url = new URL(value);

  return url.pathname + url.search + url.hash;
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
