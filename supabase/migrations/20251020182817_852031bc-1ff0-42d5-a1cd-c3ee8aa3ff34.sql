-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'shopkeeper', 'customer');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update shops RLS to use new role system
DROP POLICY IF EXISTS "Anyone can view verified shops" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can update their shops" ON public.shops;
DROP POLICY IF EXISTS "Shopkeepers can insert their own shops" ON public.shops;

CREATE POLICY "Anyone can view verified shops"
ON public.shops
FOR SELECT
USING (verification_status = 'verified');

CREATE POLICY "Shopkeepers can insert their own shops"
ON public.shops
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id AND 
  public.has_role(auth.uid(), 'shopkeeper')
);

CREATE POLICY "Shop owners can update their shops"
ON public.shops
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all shops"
ON public.shops
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all shops"
ON public.shops
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));