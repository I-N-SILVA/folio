-- Let the app ask the database what its CHECK constraints actually allow.
--
-- This repo has shipped the same bug twice: a Postgres CHECK drifting behind
-- the TypeScript enum it mirrors. 008 exists because `events.event_type`
-- allowed eleven values while the client sent thirteen, so every `page_click`
-- and `gate_unlock` was rejected for months. 012 exists because `pages.layout`
-- allowed four while the editor offered six, so choosing "Grid" produced
-- "Could not save these pages" and no way to work out why.
--
-- `lib/schema-db-drift.test.ts` compares the app's enums to the `.sql` files.
-- That catches a migration nobody wrote. It cannot catch a migration nobody
-- *applied*, which is the failure that actually reaches customers — and on
-- launch day the deployed database is the only one whose opinion matters.
--
-- So: a read-only function the health check calls. PostgREST cannot run
-- arbitrary SQL, and probing by inserting rows is not an option on a live
-- table — `books.owner_id` is NOT NULL against `auth.users`, so there is no
-- row to hang a probe off that is not a real customer's.
--
-- SECURITY DEFINER because reading `pg_constraint` needs catalog access the
-- anon and authenticated roles do not have and must not be given. Execute is
-- revoked from everyone and granted only to `service_role`, which is the
-- server-side client — the same shape as `replace_book_pages` in 009.

CREATE OR REPLACE FUNCTION public.constraint_allowed_values(
  p_table  text,
  p_column text
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- Pulls the quoted literals out of `CHECK (col = ANY (ARRAY['a'::text, …]))`,
  -- which is how Postgres normalises `CHECK (col IN ('a', …))` when it stores
  -- the expression.
  --
  -- The constraint is found by the column it actually constrains (`conkey`),
  -- not by searching its text for the column name. The string search worked for
  -- the three columns that matter and was one unlucky enum value away from
  -- matching a neighbouring constraint and reporting another column's values as
  -- this one's — which, in a tool whose whole job is to say whether the schema
  -- is right, is the worst available failure.
  SELECT COALESCE(
    (
      SELECT array_agg(m[1])
      FROM pg_constraint c
      JOIN pg_class     t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      CROSS JOIN LATERAL regexp_matches(
        pg_get_constraintdef(c.oid), '''([^'']+)''::text', 'g'
      ) AS m
      WHERE n.nspname = 'public'
        AND t.relname = p_table
        AND c.contype = 'c'
        AND a.attname = p_column
        -- A single-column CHECK only; a multi-column one has no single list of
        -- allowed values to report.
        AND array_length(c.conkey, 1) = 1
    ),
    ARRAY[]::text[]
  );
$$;

REVOKE ALL ON FUNCTION public.constraint_allowed_values(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.constraint_allowed_values(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.constraint_allowed_values(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.constraint_allowed_values(text, text) TO service_role;

COMMENT ON FUNCTION public.constraint_allowed_values(text, text) IS
  'Values a CHECK constraint on public.<table>.<column> allows. Read-only; used by /api/health to prove the live schema matches the running code.';
