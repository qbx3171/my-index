-- 乐哲软件：站内计数器（完全自建，替代 abacus / 不蒜子等第三方）
-- 用法：Supabase 控制台 → SQL Editor → 整段粘贴执行（只需一次）。
-- 执行后站点会自动切到这条通道（前端先试自家 RPC，失败才降级到 abacus）。
--
-- 设计要点：
--   * 一张极简表：key（site_pv / site_uv / day-YYYYMMDD）+ n
--   * 只暴露两个 SECURITY DEFINER 函数，表本身不开任何直接读写策略，
--     避免匿名 key 能 SELECT 全表或 INSERT 脏数据
--   * key 长度限 40，防止被当成任意 KV 滥用
--   * 唯一的已知副作用：任何人都能调 site_hit 刷数字（纯展示计数，无业务影响）

create table if not exists public.site_stats (
  key        text primary key,
  n          bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.site_stats enable row level security;
-- 故意不创建任何 policy：表不可被 anon 直接读或写

create or replace function public.site_hit(p_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v bigint;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 40 then
    raise exception 'invalid key';
  end if;
  insert into public.site_stats as s (key, n)
       values (p_key, 1)
  on conflict (key) do update
       set n = s.n + 1, updated_at = now()
  returning s.n into v;
  return v;
end;
$$;

create or replace function public.site_get(p_key text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce((select n from public.site_stats where key = p_key), 0)::bigint;
$$;

revoke all on function public.site_hit(text) from public;
revoke all on function public.site_get(text) from public;
grant execute on function public.site_hit(text) to anon, authenticated;
grant execute on function public.site_get(text) to anon, authenticated;

-- 迁移：把旧计数种进来，避免切换后数字回落到 1
-- （2026-10-31 读到的 abacus 值：site_pv=4、site_uv=4；如已有更新值请自行调整）
insert into public.site_stats(key, n) values ('site_pv', 4), ('site_uv', 4)
on conflict (key) do nothing;

-- 自检（执行完应当返回 1，再返回 0）
-- select public.site_hit('_selftest');
-- select public.site_get('_selftest');
