import type { Filters } from "@/lib/task-utils";
import type { Member, Project } from "@/types";

export interface TaskFiltersProps {
  filters: Filters;
  setFilters: (next: Filters) => void;
  developers: Member[];
  projects?: Project[] | undefined;
  showDeveloper?: boolean | undefined;
  showProject?: boolean | undefined;
}
