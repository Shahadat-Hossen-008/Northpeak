export interface TaskViewSwitcherProps {
  view: "board" | "table";
  onViewChange: (view: "board" | "table") => void;
}
