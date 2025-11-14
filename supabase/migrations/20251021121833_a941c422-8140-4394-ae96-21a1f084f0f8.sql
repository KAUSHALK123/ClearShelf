-- Fix the SECURITY DEFINER view issue by recreating as SECURITY INVOKER
DROP VIEW IF EXISTS public.shop_owners_public;

CREATE OR REPLACE VIEW public.shop_owners_public 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.name,
  s.id as shop_id
FROM public.profiles p
INNER JOIN public.shops s ON s.owner_id = p.id
WHERE s.verification_status = 'verified';

-- Grant access to the view
GRANT SELECT ON public.shop_owners_public TO authenticated, anon;