// Shared Project service types used by the project workflow modules.
// Called by the Project service modules.
// This file owns no database queries, request handling, or side effects.

export interface CreateProjectInput {
  title?: string;
  description?: string;
  start_date?: string | null;
  deadline?: string | null;
  priority?: any;
  team?: any[];
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  start_date?: string | null;
  deadline?: string | null;
  priority?: any;
  team?: any[];
}
