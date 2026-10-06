create schema t;
grant usage on schema t to public;
create table t.results(n serial, name text, ok boolean, detail text);
grant all on t.results to public; grant all on sequence t.results_n_seq to public;
create function t.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); execute 'set role authenticated'; end $$;
create function t.as_anon() returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', '', false); execute 'set role anon'; end $$;
create function t.as_super() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;
-- expect = null -> statement must succeed ; otherwise must fail with message/sqlstate containing expect
create function t.run(nm text, q text, expect text default null) returns void language plpgsql as $$
begin
  execute q;
  insert into t.results(name, ok, detail) values (nm, expect is null, case when expect is null then 'ok' else 'expected error '||expect||' but succeeded' end);
exception when others then
  insert into t.results(name, ok, detail) values (nm, expect is not null and (sqlerrm like '%'||expect||'%' or sqlstate = expect), sqlstate||' '||sqlerrm);
end $$;
create function t.eq(nm text, q text, expected text) returns void language plpgsql as $$
declare v text;
begin
  execute 'select ('||q||')::text' into v;
  insert into t.results(name, ok, detail) values (nm, v is not distinct from expected, 'got='||coalesce(v,'NULL')||' expected='||expected);
exception when others then
  insert into t.results(name, ok, detail) values (nm, false, sqlstate||' '||sqlerrm);
end $$;
