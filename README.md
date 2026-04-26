# memora

A calm, offline-first second brain web app based on the original HTML prototype.

## Run locally

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## What works

- Create, edit, read, and delete entries
- Persistent local storage in the browser
- Supabase Auth and cloud sync, preconfigured for the current project
- Archive and restore entries
- Branded PDF export for saved entries
- Search with `Cmd/Ctrl + K`
- List and grid layouts
- Tag filtering
- Today, Projects, Timeline, and Reflect views
- Responsive layout for desktop and mobile

## Supabase setup

The app is preconfigured with the current Supabase project URL and publishable anon key, so email sign-in can work immediately. You can still open `Cloud sync` in the app to switch projects or update the settings later.

Create a table named `memora_entries`:

```sql
create table public.memora_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, entry_id)
);

alter table public.memora_entries enable row level security;

create policy "Users can manage their own memora entries"
on public.memora_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Create a profile table for onboarding sign-ups:

```sql
create table public.memora_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.memora_profiles enable row level security;

create policy "Users can manage their own memora profile"
on public.memora_profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);
```

In Supabase, enable the Auth providers you want: Google, Apple, email, and phone. Right now the app reads the provider settings from Supabase and will only enable the methods that are actually turned on for the project.

## PDF export

Every saved entry can be exported as a branded PDF. The export includes the mem·ora logo, title, type, project, tags, created date/time, paginated content, and a final personalized signature based on the signed-in profile name when available.
