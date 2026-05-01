-- FocusMind Supabase schema
-- Apply this in the Supabase SQL editor before deploying.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  total_study_seconds integer not null default 0,
  total_sessions integer not null default 0,
  total_voice_questions integer not null default 0,
  streak_days integer not null default 0,
  last_study_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material text not null default '',
  freq_key text not null default 'beta' check (freq_key in ('gamma', 'beta', 'alpha', 'theta')),
  pom_phase text not null default 'focus' check (pom_phase in ('focus', 'shortBreak', 'longBreak')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  focus_rating integer check (focus_rating between 1 and 5),
  voice_questions integer not null default 0 check (voice_questions >= 0),
  weak_areas text[] not null default '{}',
  covered_topics text,
  ai_insight text,
  next_focus_topic text,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.study_sessions(id) on delete set null,
  material text not null default '',
  round_number integer not null default 1 check (round_number > 0),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  score integer not null default 0 check (score >= 0),
  total_questions integer not null default 1 check (total_questions > 0),
  topics_tested text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (score <= total_questions)
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  mastery_level text not null default 'learning' check (mastery_level in ('learning', 'developing', 'proficient', 'mastered')),
  encounter_count integer not null default 0 check (encounter_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  next_review timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic),
  check (correct_count <= encounter_count)
);

create index if not exists study_sessions_user_created_idx on public.study_sessions(user_id, created_at desc);
create index if not exists quiz_results_user_created_idx on public.quiz_results(user_id, created_at desc);
create index if not exists learning_progress_user_review_idx on public.learning_progress(user_id, next_review);

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.quiz_results enable row level security;
alter table public.learning_progress enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "study_sessions_select_own" on public.study_sessions;
create policy "study_sessions_select_own" on public.study_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "study_sessions_insert_own" on public.study_sessions;
create policy "study_sessions_insert_own" on public.study_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "study_sessions_update_own" on public.study_sessions;
create policy "study_sessions_update_own" on public.study_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_sessions_delete_own" on public.study_sessions;
create policy "study_sessions_delete_own" on public.study_sessions
  for delete using (auth.uid() = user_id);

drop policy if exists "quiz_results_select_own" on public.quiz_results;
create policy "quiz_results_select_own" on public.quiz_results
  for select using (auth.uid() = user_id);

drop policy if exists "quiz_results_insert_own" on public.quiz_results;
create policy "quiz_results_insert_own" on public.quiz_results
  for insert with check (auth.uid() = user_id);

drop policy if exists "quiz_results_update_own" on public.quiz_results;
create policy "quiz_results_update_own" on public.quiz_results
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "quiz_results_delete_own" on public.quiz_results;
create policy "quiz_results_delete_own" on public.quiz_results
  for delete using (auth.uid() = user_id);

drop policy if exists "learning_progress_select_own" on public.learning_progress;
create policy "learning_progress_select_own" on public.learning_progress
  for select using (auth.uid() = user_id);

drop policy if exists "learning_progress_insert_own" on public.learning_progress;
create policy "learning_progress_insert_own" on public.learning_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "learning_progress_update_own" on public.learning_progress;
create policy "learning_progress_update_own" on public.learning_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "learning_progress_delete_own" on public.learning_progress;
create policy "learning_progress_delete_own" on public.learning_progress
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists learning_progress_set_updated_at on public.learning_progress;
create trigger learning_progress_set_updated_at
before update on public.learning_progress
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.compute_mastery()
returns trigger
language plpgsql
as $$
declare
  accuracy numeric;
begin
  accuracy := case when new.encounter_count > 0
    then new.correct_count::numeric / new.encounter_count
    else 0
  end;

  new.mastery_level := case
    when new.encounter_count >= 5 and accuracy >= 0.85 then 'mastered'
    when new.encounter_count >= 3 and accuracy >= 0.70 then 'proficient'
    when new.encounter_count >= 2 and accuracy >= 0.50 then 'developing'
    else 'learning'
  end;

  return new;
end;
$$;

drop trigger if exists learning_progress_compute_mastery on public.learning_progress;
create trigger learning_progress_compute_mastery
before insert or update on public.learning_progress
for each row execute function public.compute_mastery();

create or replace function public.increment_profile_stats(
  p_user_id uuid,
  p_study_seconds integer,
  p_voice_questions integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'not allowed';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  update public.profiles
  set
    total_study_seconds = total_study_seconds + greatest(coalesce(p_study_seconds, 0), 0),
    total_sessions = total_sessions + 1,
    total_voice_questions = total_voice_questions + greatest(coalesce(p_voice_questions, 0), 0),
    streak_days = case
      when last_study_date = current_date then streak_days
      when last_study_date = current_date - 1 then streak_days + 1
      else 1
    end,
    last_study_date = current_date,
    updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.upsert_topic_progress(
  p_user_id uuid,
  p_topics text[],
  p_correct boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  topic_value text;
  review_delay interval;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'not allowed';
  end if;

  review_delay := case when p_correct then interval '3 days' else interval '1 day' end;

  foreach topic_value in array coalesce(p_topics, '{}'::text[])
  loop
    topic_value := left(lower(trim(topic_value)), 100);
    if topic_value = '' then
      continue;
    end if;

    insert into public.learning_progress (
      user_id,
      topic,
      encounter_count,
      correct_count,
      next_review
    )
    values (
      p_user_id,
      topic_value,
      1,
      case when p_correct then 1 else 0 end,
      now() + review_delay
    )
    on conflict (user_id, topic) do update
    set
      encounter_count = public.learning_progress.encounter_count + 1,
      correct_count = public.learning_progress.correct_count + case when p_correct then 1 else 0 end,
      next_review = now() + review_delay,
      updated_at = now();
  end loop;
end;
$$;
