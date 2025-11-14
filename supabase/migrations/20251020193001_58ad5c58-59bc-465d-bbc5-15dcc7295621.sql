-- Phase 1: Add email to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Phase 2: Update handle_new_user trigger to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get role from metadata, default to customer
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer');

  -- Insert into profiles with email
  INSERT INTO public.profiles (id, name, email, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer'),
    NEW.raw_user_meta_data->>'phone'
  );

  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  RETURN NEW;
END;
$$;

-- Phase 3: Create function to notify admins of new shop registrations
CREATE OR REPLACE FUNCTION public.notify_admins_new_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if shop is pending
  IF NEW.verification_status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_product_id)
    SELECT 
      ur.user_id,
      'New Shop Registration',
      'A new shop "' || NEW.name || '" is pending verification.',
      'shop_registration',
      NULL
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new shop registrations
DROP TRIGGER IF EXISTS trigger_notify_admins_new_shop ON public.shops;
CREATE TRIGGER trigger_notify_admins_new_shop
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_shop();

-- Phase 4: Create function to notify shop owner of verification status change
CREATE OR REPLACE FUNCTION public.notify_shop_owner_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if status changed
  IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    IF NEW.verification_status = 'verified' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.owner_id,
        'Shop Approved! 🎉',
        'Your shop "' || NEW.name || '" has been verified and is now live!',
        'shop_approved'
      );
    ELSIF NEW.verification_status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.owner_id,
        'Shop Registration Update',
        'Your shop "' || NEW.name || '" registration needs attention. Reason: ' || COALESCE(NEW.rejection_reason, 'Not specified'),
        'shop_rejected'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for shop status changes
DROP TRIGGER IF EXISTS trigger_notify_shop_owner_status_change ON public.shops;
CREATE TRIGGER trigger_notify_shop_owner_status_change
  AFTER UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shop_owner_status_change();

-- Phase 5: Add RLS policy for shopkeepers to view their own shops
DROP POLICY IF EXISTS "Shopkeepers can view their own shops" ON public.shops;
CREATE POLICY "Shopkeepers can view their own shops"
  ON public.shops
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Phase 6: Backfill existing profile emails from auth.users
-- Note: This will be done via a one-time data sync, emails should now be populated via trigger for new users