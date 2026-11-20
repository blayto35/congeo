ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS profile_photo BYTEA,
ADD COLUMN IF NOT EXISTS profile_photo_type VARCHAR(50);

CREATE TABLE IF NOT EXISTS public.organization_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    organization_name VARCHAR(120) NOT NULL DEFAULT 'Mon organisation',
    organization_logo BYTEA,
    organization_logo_type VARCHAR(50),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.organization_settings (id, organization_name)
VALUES (1, 'Mon organisation')
ON CONFLICT (id) DO NOTHING;
