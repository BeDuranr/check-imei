-- Esquema inicial: historial de chequeos y seguimiento de equipos para reventa.
-- Solo el servidor accede (service role key). RLS activado sin políticas públicas.

create table public.checks (
  id            uuid primary key default gen_random_uuid(),
  imei          text not null,
  level         text not null check (level in ('descarte', 'procedencia')),
  status        text not null check (status in ('pending', 'success', 'partial', 'failed')),
  model         text,
  order_ids     integer[] not null default '{}',
  services      integer[] not null default '{}',
  cost_usd      numeric(10, 2) not null default 0,
  raw_responses jsonb not null default '[]'::jsonb,
  report        jsonb,
  verdict       text check (verdict in ('verde', 'amarillo', 'rojo')),
  origin        text check (origin in ('retail', 'compañia', 'desconocido')),
  reasons       text[] not null default '{}',
  error_message text,
  created_at    timestamptz not null default now()
);

create index checks_imei_level_created_idx on public.checks (imei, level, created_at desc);
create index checks_created_idx on public.checks (created_at desc);

-- Evita dos consultas en paralelo del mismo IMEI y nivel (bloqueo de duplicados).
create unique index checks_one_pending_idx on public.checks (imei, level) where status = 'pending';

create table public.devices (
  imei               text primary key,
  model              text,
  purchase_price_clp integer check (purchase_price_clp is null or purchase_price_clp >= 0),
  decision           text not null default 'pendiente' check (decision in ('pendiente', 'comprado', 'descartado')),
  notes              text not null default '',
  updated_at         timestamptz not null default now()
);

alter table public.checks enable row level security;
alter table public.devices enable row level security;

-- Sin políticas: anon y authenticated no pueden leer ni escribir. La service role ignora RLS.
revoke all on public.checks from anon, authenticated;
revoke all on public.devices from anon, authenticated;
