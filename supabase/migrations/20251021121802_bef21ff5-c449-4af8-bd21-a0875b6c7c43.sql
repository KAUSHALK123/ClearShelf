-- Fix 1: Restrict profiles table to own profile only
-- First drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a restrictive policy for own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Create a public view that exposes ONLY safe shop owner info (name only, no email/phone)
CREATE OR REPLACE VIEW public.shop_owners_public AS
SELECT 
  p.id,
  p.name,
  s.id as shop_id
FROM public.profiles p
INNER JOIN public.shops s ON s.owner_id = p.id
WHERE s.verification_status = 'verified';

-- Grant access to the view
GRANT SELECT ON public.shop_owners_public TO authenticated, anon;

-- Admins can still view all profiles through a separate policy
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Restrict transactions to authenticated shop owners only
DROP POLICY IF EXISTS "Anyone can create transactions" ON public.transactions;

-- Only shopkeepers can create transactions for their own shops
CREATE POLICY "Shop owners can create transactions"
ON public.transactions 
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops
    WHERE shops.id = shop_id
    AND shops.owner_id = auth.uid()
    AND shops.verification_status = 'verified'
  )
);