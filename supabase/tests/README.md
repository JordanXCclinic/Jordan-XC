# Database tests

These check the parts of the schema that are security boundaries: role
assignment, invite-code redemption, and who can see an athlete's records.

`harness.sql` stands in for the Supabase primitives the migrations depend on
(`auth.users`, `auth.uid()`, and the `anon` / `authenticated` roles) so the
migrations can run against a plain Postgres instance.

## Running them

Against any local Postgres 16:

```sh
createdb jxc
psql -d jxc -v ON_ERROR_STOP=1 \
  -f supabase/tests/harness.sql \
  -f supabase/migrations/0001_initial_schema.sql \
  -f supabase/migrations/0002_invite_codes.sql
psql -d jxc -f supabase/tests/rls_test.sql 2>&1 | grep -E 'PASS|FAIL'
```

Every line must say PASS. Re-run against a freshly created database — the
tests insert fixed UUIDs and are not idempotent.

## Why these particular tests

`redeem_invite_code()` is the only path that sets `profiles.role`, so the
suite pins the behavior that makes that safe: a user cannot update their own
role, cannot reuse or read someone else's code, and cannot see an athlete they
are not linked to. If you change a policy and these still pass, the change is
probably fine. If one fails, do not work around it.
