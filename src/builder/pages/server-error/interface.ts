export interface ServerErrorPageProps {
  error?: Error | undefined;
  reset?: (() => void) | undefined;
  className?: string | undefined;
}
