-- A daily count of emails sent, so the app can live inside a free email plan.
--
-- Resend's free plan allows 100 emails a day and 3,000 a month, and refuses
-- the rest. The weekly digest sent up to 200 per run, so on that plan half of
-- every run failed — and because a profile's digest slot is claimed before
-- sending, each failure cost that author their week. Lead notifications, the
-- email an author most wants, competed for the same 100.
--
-- `claim_email_send` counts sends per UTC day and refuses one past the limit
-- the caller passes. The digest asks with a lower limit than lead
-- notifications, so the digest can never use up the room a lead needs.
-- Without the env limits set (a paid email plan), the app never calls this.

CREATE TABLE IF NOT EXISTS public.email_sends (
  day   date PRIMARY KEY,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0)
);

-- Server only.
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- True if one more email may go out today under `p_limit`, counting it.
-- Atomic: the row lock makes two senders racing for the last slot get one
-- each, not both.
CREATE OR REPLACE FUNCTION public.claim_email_send(p_day date, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.email_sends (day, count) VALUES (p_day, 0)
  ON CONFLICT (day) DO NOTHING;

  SELECT count INTO v_count FROM public.email_sends WHERE day = p_day FOR UPDATE;
  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.email_sends SET count = count + 1 WHERE day = p_day;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_send(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send(date, integer) TO service_role;

COMMENT ON FUNCTION public.claim_email_send(date, integer) IS
  'Counts one email against today''s total if it is under p_limit; returns whether it may be sent.';
