-- Run once in Supabase SQL editor if Alembic is not used for this environment.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS walk_score BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.user_wearables (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    terra_user_id VARCHAR(128) NOT NULL UNIQUE,
    reference_id VARCHAR(128) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_timestamp TIMESTAMPTZ,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_user_wearables_user_id ON public.user_wearables(user_id);

CREATE TABLE IF NOT EXISTS public.wearable_daily_steps (
    id UUID PRIMARY KEY,
    wearable_id UUID NOT NULL REFERENCES public.user_wearables(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    steps INTEGER NOT NULL CHECK (steps BETWEEN 0 AND 100000),
    UNIQUE (wearable_id, activity_date)
);
CREATE TABLE IF NOT EXISTS public.walk_score_days (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    steps INTEGER NOT NULL DEFAULT 0 CHECK (steps BETWEEN 0 AND 100000),
    PRIMARY KEY (user_id, activity_date)
);

-- Only the backend's database role may modify wearable-derived scores.
ALTER TABLE public.user_wearables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_daily_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_score_days ENABLE ROW LEVEL SECURITY;

-- The existing users_update_own policy permits broad row updates through
-- Supabase Auth. Guard the server-owned score column from those roles.
CREATE OR REPLACE FUNCTION public.protect_walk_score() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' AND COALESCE(NEW.walk_score, 0) <> 0 THEN
            RAISE EXCEPTION 'walk_score is server managed';
        ELSIF TG_OP = 'UPDATE' AND NEW.walk_score IS DISTINCT FROM OLD.walk_score THEN
            RAISE EXCEPTION 'walk_score is server managed';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_walk_score ON public.users;
CREATE TRIGGER trg_protect_walk_score
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_walk_score();
