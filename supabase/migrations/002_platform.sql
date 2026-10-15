-- Soporte para varias marcas (docs/plan-android.md). Los chequeos existentes quedan como iPhone.

alter table public.checks
  add column platform text not null default 'iphone'
  check (platform in ('iphone', 'samsung', 'xiaomi', 'motorola', 'huawei', 'honor', 'oneplus', 'pixel', 'android'));

create index checks_platform_idx on public.checks (platform);
