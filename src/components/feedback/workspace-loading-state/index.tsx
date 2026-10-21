interface WorkspaceLoadingStateProps {
  className?: string;
}

export function WorkspaceLoadingState({ className }: WorkspaceLoadingStateProps = {}) {
  return (
    <div
      className={`fixed inset-0 z-100 flex min-h-screen w-full items-center justify-center bg-background p-4${className ? ` ${className}` : ""}`}
      role="status"
      aria-label="Loading your workspace"
      aria-live="polite"
    >
      <img
        className="h-auto w-full max-w-120"
        src="/northpeak-loader.svg"
        width="480"
        height="300"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
