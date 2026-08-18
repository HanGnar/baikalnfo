import { sql, fail } from './_db.js';

/* 표를 만든다. 여러 번 불러도 안전하다. */
export default async function handler(req, res) {
  try {
    const q = sql();

    await q`
      create table if not exists keys (
        gender     text        not null check (gender in ('m','f')),
        no         int         not null check (no between 1 and 250),
        status     text        not null check (status in ('lost','broken','etc')),
        memo       text        not null default '',
        photos     text[]      not null default '{}',
        updated_at timestamptz not null default now(),
        primary key (gender, no)
      )`;

    for (const t of ['handover', 'memo', 'posts']) {
      await q(`
        create table if not exists ${t} (
          id        bigserial   primary key,
          body      text        not null default '',
          photos    text[]      not null default '{}',
          fav       boolean     not null default false,
          at        timestamptz not null default now(),
          edited_at timestamptz
        )`);
      await q(`create index if not exists ${t}_at_idx on ${t} (at desc)`);
    }

    const tables = await q`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;

    res.status(200).json({ ok: true, tables: tables.map(r => r.table_name) });
  } catch (e) { fail(res, e); }
}
