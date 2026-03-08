# ServiceVault — Field Service Tracker

A full-stack field service management app backed by Supabase.

## Tech Stack
- **Frontend**: React 18 + Vite
- **Database**: Supabase (PostgreSQL)

## Deploy to Vercel (recommended)

### Option A — GitHub + Vercel (easiest)

1. Create a free account at https://github.com and https://vercel.com
2. Create a new GitHub repository (e.g. `servicevault`)
3. Upload all files in this folder to the repo (drag & drop on GitHub works)
4. Go to https://vercel.com/new → Import your GitHub repo
5. Leave all settings as default → click **Deploy**
6. Done! Vercel gives you a live URL like `https://servicevault.vercel.app`

### Option B — Vercel CLI

```bash
npm install -g vercel
cd servicevault
npm install
vercel
```

Follow the prompts — it deploys in ~30 seconds.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Database

This app uses Supabase. The connection is already configured in `src/App.jsx`.

To reset or re-run the database schema, go to your Supabase project → SQL Editor and run:

```sql
create table users (
  id serial primary key,
  username text unique not null,
  password text not null,
  name text not null,
  role text not null default 'technician'
);

create table branches (
  id text primary key,
  city text not null,
  address text not null,
  description text,
  distance_km numeric not null default 0,
  servers int not null default 0,
  switches int not null default 0,
  has_mikrotik boolean not null default false
);

create table jobs (
  id text primary key,
  branch_id text references branches(id),
  user_id int references users(id),
  departure_time timestamptz,
  arrival_time timestamptz,
  hours_worked numeric,
  return_time timestamptz,
  km_travelled numeric,
  description text,
  created_at timestamptz default now()
);

insert into users (username, password, name, role)
values ('admin', 'admin123', 'Admin', 'admin');
```
