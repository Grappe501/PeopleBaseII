-- Poll crosstabs (Zogby-style PDF extraction). Apply after 001 (set_updated_at) if triggers are needed.

create table if not exists public.poll_surveys (
  id bigint generated always as identity primary key,
  name text not null,
  poll_start_date date not null,
  poll_end_date date not null,
  geography text not null,
  sample_size int,
  margin_of_error_pct numeric(8, 4),
  pollster text,
  source_files jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint poll_surveys_name_unique unique (name)
);

create table if not exists public.poll_questions (
  id bigint generated always as identity primary key,
  survey_id bigint not null references public.poll_surveys (id) on delete cascade,
  question_number int not null,
  question_text text not null,
  constraint poll_questions_survey_qnum_unique unique (survey_id, question_number)
);

create index if not exists poll_questions_survey_id_idx on public.poll_questions (survey_id);

create table if not exists public.poll_crosstabs (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.poll_questions (id) on delete cascade,
  pdf_page int,
  table_index int not null default 0,
  segment_group_raw text not null,
  segment_label_raw text not null,
  segment_type text,
  segment_value text not null,
  response_label text not null,
  pct numeric(12, 6),
  sample_n int,
  header_row1 text,
  header_row2 text,
  created_at timestamptz not null default now()
);

create index if not exists poll_crosstabs_question_id_idx on public.poll_crosstabs (question_id);
create index if not exists poll_crosstabs_segment_type_idx on public.poll_crosstabs (segment_type);
