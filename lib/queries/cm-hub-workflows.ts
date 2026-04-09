import sql from "@/lib/db";
import type {
  WorkflowBoardPayload,
  WorkflowCreateTaskInput,
  WorkflowDepartment,
  WorkflowListPayload,
  WorkflowTaskListFilters,
  WorkflowTaskRow,
  WorkflowTaskStatus,
  WorkflowUpdateTaskInput,
  WorkflowDependencyInput,
} from "@/lib/types/contracts/cm-hub-workflows";

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asDept(v: string | null): WorkflowDepartment {
  switch (v) {
    case "field":
    case "volunteers":
    case "events":
    case "comms":
    case "social":
    case "digital":
    case "fundraising":
    case "data":
      return v;
    default:
      return "campaign";
  }
}

function asStatus(v: string | null): WorkflowTaskStatus {
  switch (v) {
    case "ready":
    case "in_progress":
    case "blocked":
    case "complete":
      return v;
    default:
      return "backlog";
  }
}

export async function listWorkflowTasks(
  filters?: WorkflowTaskListFilters,
): Promise<WorkflowListPayload> {
  const limit = Number.isFinite(filters?.limit) ? Math.min(Math.max(filters!.limit!, 1), 200) : 200;
  const offset = Number.isFinite(filters?.offset) ? Math.max(filters!.offset!, 0) : 0;
  const department = filters?.department ?? null;
  const status = filters?.status ?? null;
  const owner = filters?.owner ?? null;
  const countyId = filters?.countyId ?? null;

  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      updated_at: Date | string;
      title: string;
      description: string | null;
      department: string;
      owner: string | null;
      county_id: string | number | null;
      county_name: string | null;
      volunteer_id: string | number | null;
      volunteer_name: string | null;
      turf_id: string | number | null;
      turf_name: string | null;
      event_id: string | number | null;
      priority: string;
      status: string;
      due_at: Date | string | null;
      dependency_count: string | number;
      incomplete_dependency_count: string | number;
    }>
  >`
    with deps as (
      select
        d.task_id,
        count(*)::bigint as dependency_count,
        count(*) filter (where t2.status <> 'complete')::bigint as incomplete_dependency_count
      from public.workflow_task_dependencies d
      join public.workflow_tasks t2 on t2.id = d.depends_on_task_id
      group by 1
    )
    select
      t.id,
      t.created_at,
      t.updated_at,
      t.title,
      t.description,
      t.department,
      t.owner,
      t.county_id,
      gc.county_name,
      t.volunteer_id,
      case
        when v.id is null then null
        else concat_ws(' ', v.first_name, v.last_name)
      end as volunteer_name,
      t.turf_id,
      tf.turf_name,
      t.event_id,
      t.priority,
      t.status,
      t.due_at,
      coalesce(d.dependency_count, 0)::bigint as dependency_count,
      coalesce(d.incomplete_dependency_count, 0)::bigint as incomplete_dependency_count
    from public.workflow_tasks t
    left join deps d on d.task_id = t.id
    left join public.geo_counties gc on gc.id = t.county_id
    left join public.volunteers v on v.id = t.volunteer_id
    left join public.turfs tf on tf.id = t.turf_id
    where (${department} is null or t.department = ${department})
      and (${status} is null or t.status = ${status})
      and (${owner} is null or t.owner = ${owner})
      and (${countyId} is null or t.county_id = ${countyId})
    order by
      (case t.priority
        when 'critical' then 1
        when 'high' then 2
        when 'medium' then 3
        else 4
      end) asc,
      t.due_at asc nulls last,
      t.updated_at desc,
      t.id desc
    limit ${limit}
    offset ${offset}
  `;

  const mapped: WorkflowTaskRow[] = rows.map((r) => {
    const dependencyCount = Number(r.dependency_count ?? 0);
    const incompleteDependencyCount = Number(r.incomplete_dependency_count ?? 0);
    return {
      id: Number(r.id),
      createdAt: iso(r.created_at) ?? new Date(0).toISOString(),
      updatedAt: iso(r.updated_at) ?? new Date(0).toISOString(),
      title: r.title,
      description: r.description,
      department: asDept(r.department),
      owner: r.owner,
      countyId: r.county_id != null ? Number(r.county_id) : null,
      countyName: r.county_name,
      volunteerId: r.volunteer_id != null ? Number(r.volunteer_id) : null,
      volunteerName: r.volunteer_name,
      turfId: r.turf_id != null ? Number(r.turf_id) : null,
      turfName: r.turf_name,
      eventId: r.event_id != null ? Number(r.event_id) : null,
      priority: (r.priority as WorkflowTaskRow["priority"]) ?? "medium",
      status: asStatus(r.status),
      dueAt: iso(r.due_at),
      dependencyCount,
      incompleteDependencyCount,
      isBlockedByDependencies: incompleteDependencyCount > 0,
    };
  });

  return {
    filters: {
      limit,
      offset,
      department: filters?.department,
      status: filters?.status,
      owner: filters?.owner,
      countyId: filters?.countyId,
    },
    rows: mapped,
  };
}

export async function getWorkflowBoard(
  filters?: Omit<WorkflowTaskListFilters, "status">,
): Promise<WorkflowBoardPayload> {
  const list = await listWorkflowTasks({ ...filters, status: undefined, limit: filters?.limit ?? 500, offset: filters?.offset ?? 0 });
  const columns: WorkflowBoardPayload["columns"] = {
    backlog: [],
    ready: [],
    in_progress: [],
    blocked: [],
    complete: [],
  };
  for (const t of list.rows) {
    const effectiveStatus: WorkflowTaskStatus =
      t.status !== "complete" && t.isBlockedByDependencies ? "blocked" : t.status;
    columns[effectiveStatus].push(t);
  }
  return {
    filters: {
      limit: list.filters.limit,
      offset: list.filters.offset,
      department: filters?.department,
      owner: filters?.owner,
      countyId: filters?.countyId,
    },
    columns,
  };
}

export async function createWorkflowTask(input: WorkflowCreateTaskInput): Promise<WorkflowTaskRow> {
  const title = input.title?.trim();
  if (!title) throw new Error("title is required");

  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      updated_at: Date | string;
      title: string;
      description: string | null;
      department: string;
      owner: string | null;
      county_id: string | number | null;
      county_name: string | null;
      volunteer_id: string | number | null;
      volunteer_name: string | null;
      turf_id: string | number | null;
      turf_name: string | null;
      event_id: string | number | null;
      priority: string;
      status: string;
      due_at: Date | string | null;
      dependency_count: string | number;
      incomplete_dependency_count: string | number;
    }>
  >`
    insert into public.workflow_tasks (
      title, description, department, owner,
      county_id, volunteer_id, turf_id, event_id,
      priority, status, due_at
    ) values (
      ${title},
      ${input.description ?? null},
      ${input.department ?? "campaign"},
      ${input.owner ?? null},
      ${input.countyId ?? null},
      ${input.volunteerId ?? null},
      ${input.turfId ?? null},
      ${input.eventId ?? null},
      ${input.priority ?? "medium"},
      ${input.status ?? "backlog"},
      ${input.dueAt ? new Date(input.dueAt) : null}
    )
    returning
      id, created_at, updated_at, title, description, department, owner,
      county_id,
      null::text as county_name,
      volunteer_id,
      null::text as volunteer_name,
      turf_id,
      null::text as turf_name,
      event_id, priority, status, due_at,
      0::bigint as dependency_count,
      0::bigint as incomplete_dependency_count
  `;

  const r = rows[0]!;
  return {
    id: Number(r.id),
    createdAt: iso(r.created_at) ?? new Date(0).toISOString(),
    updatedAt: iso(r.updated_at) ?? new Date(0).toISOString(),
    title: r.title,
    description: r.description,
    department: asDept(r.department),
    owner: r.owner,
    countyId: r.county_id != null ? Number(r.county_id) : null,
    countyName: null,
    volunteerId: r.volunteer_id != null ? Number(r.volunteer_id) : null,
    volunteerName: null,
    turfId: r.turf_id != null ? Number(r.turf_id) : null,
    turfName: null,
    eventId: r.event_id != null ? Number(r.event_id) : null,
    priority: (r.priority as WorkflowTaskRow["priority"]) ?? "medium",
    status: asStatus(r.status),
    dueAt: iso(r.due_at),
    dependencyCount: 0,
    incompleteDependencyCount: 0,
    isBlockedByDependencies: false,
  };
}

export async function updateWorkflowTask(input: WorkflowUpdateTaskInput): Promise<void> {
  await sql`
    update public.workflow_tasks
    set
      title = coalesce(${input.title?.trim() ?? null}, title),
      description = coalesce(${input.description ?? null}, description),
      department = coalesce(${input.department ?? null}, department),
      owner = coalesce(${input.owner ?? null}, owner),
      county_id = coalesce(${input.countyId ?? null}, county_id),
      volunteer_id = coalesce(${input.volunteerId ?? null}, volunteer_id),
      turf_id = coalesce(${input.turfId ?? null}, turf_id),
      event_id = coalesce(${input.eventId ?? null}, event_id),
      priority = coalesce(${input.priority ?? null}, priority),
      status = coalesce(${input.status ?? null}, status),
      due_at = coalesce(${input.dueAt ? new Date(input.dueAt) : null}, due_at),
      updated_at = now()
    where id = ${input.id}
  `;
}

export async function addWorkflowDependency(input: WorkflowDependencyInput): Promise<void> {
  if (input.taskId === input.dependsOnTaskId) throw new Error("Task cannot depend on itself");
  await sql`
    insert into public.workflow_task_dependencies (task_id, depends_on_task_id)
    values (${input.taskId}, ${input.dependsOnTaskId})
    on conflict (task_id, depends_on_task_id) do nothing
  `;
}

export async function removeWorkflowDependency(input: WorkflowDependencyInput): Promise<void> {
  await sql`
    delete from public.workflow_task_dependencies
    where task_id = ${input.taskId}
      and depends_on_task_id = ${input.dependsOnTaskId}
  `;
}

