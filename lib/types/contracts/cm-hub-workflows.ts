export type WorkflowTaskStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "complete";

export type WorkflowTaskPriority = "low" | "medium" | "high" | "critical";

export type WorkflowDepartment =
  | "campaign"
  | "field"
  | "volunteers"
  | "events"
  | "comms"
  | "social"
  | "digital"
  | "fundraising"
  | "data";

export type WorkflowTaskRow = {
  id: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string | null;
  department: WorkflowDepartment;
  owner: string | null;
  countyId: number | null;
  countyName: string | null;
  volunteerId: number | null;
  volunteerName: string | null;
  turfId: number | null;
  turfName: string | null;
  eventId: number | null;
  priority: WorkflowTaskPriority;
  status: WorkflowTaskStatus;
  dueAt: string | null;
  dependencyCount: number;
  incompleteDependencyCount: number;
  isBlockedByDependencies: boolean;
};

export type WorkflowTaskListFilters = {
  department?: WorkflowDepartment;
  status?: WorkflowTaskStatus;
  owner?: string;
  countyId?: number;
  limit?: number;
  offset?: number;
};

export type WorkflowBoardPayload = {
  filters: Required<Pick<WorkflowTaskListFilters, "limit" | "offset">> &
    Pick<WorkflowTaskListFilters, "department" | "owner" | "countyId">;
  columns: Record<WorkflowTaskStatus, WorkflowTaskRow[]>;
};

export type WorkflowListPayload = {
  filters: Required<Pick<WorkflowTaskListFilters, "limit" | "offset">> &
    Pick<WorkflowTaskListFilters, "department" | "status" | "owner" | "countyId">;
  rows: WorkflowTaskRow[];
};

export type WorkflowCreateTaskInput = {
  title: string;
  description?: string | null;
  department?: WorkflowDepartment;
  owner?: string | null;
  countyId?: number | null;
  volunteerId?: number | null;
  turfId?: number | null;
  eventId?: number | null;
  priority?: WorkflowTaskPriority;
  status?: WorkflowTaskStatus;
  dueAt?: string | null;
};

export type WorkflowUpdateTaskInput = Partial<WorkflowCreateTaskInput> & {
  id: number;
};

export type WorkflowDependencyInput = {
  taskId: number;
  dependsOnTaskId: number;
};

