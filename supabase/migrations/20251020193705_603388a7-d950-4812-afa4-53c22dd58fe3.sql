-- Fix: enable embedded selection by defining FK shops.owner_id -> profiles.id
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);

-- Add the foreign key (only if it doesn't exist yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'shops' AND c.conname = 'shops_owner_id_fkey'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_owner_id_fkey
      FOREIGN KEY (owner_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;