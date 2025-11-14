-- Phase 1: Database Schema Enhancements for Admin Module

-- Create enum types for complaints and announcement banners
CREATE TYPE complaint_category AS ENUM ('fake_discount', 'expired_product', 'wrong_listing', 'poor_service', 'other');
CREATE TYPE complaint_status AS ENUM ('pending', 'in_progress', 'resolved', 'rejected');
CREATE TYPE announcement_type AS ENUM ('info', 'warning', 'success', 'error');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deactivated');

-- 1. Complaints Table
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category complaint_category NOT NULL DEFAULT 'other',
  status complaint_status NOT NULL DEFAULT 'pending',
  resolution_note TEXT,
  assigned_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 2. Admin Activity Logs Table
CREATE TABLE public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. System Settings Table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Announcement Banners Table
CREATE TABLE public.announcement_banners (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type announcement_type NOT NULL DEFAULT 'info',
  target_roles TEXT[] NOT NULL DEFAULT ARRAY['all'],
  active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Enhance Shops Table
ALTER TABLE public.shops
ADD COLUMN suspension_reason TEXT,
ADD COLUMN suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN suspended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN rejection_reason TEXT,
ADD COLUMN verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;

-- 6. Enhance Profiles Table
ALTER TABLE public.profiles
ADD COLUMN status user_status NOT NULL DEFAULT 'active',
ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_banners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Complaints
CREATE POLICY "Customers can insert their own complaints"
ON public.complaints
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own complaints"
ON public.complaints
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

CREATE POLICY "Admins can view all complaints"
ON public.complaints
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all complaints"
ON public.complaints
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for Admin Activity Logs
CREATE POLICY "Admins can insert their own logs"
ON public.admin_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id);

CREATE POLICY "Admins can view all logs"
ON public.admin_activity_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for System Settings
CREATE POLICY "Admins can view all settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for Announcement Banners
CREATE POLICY "Everyone can view active banners for their role"
ON public.announcement_banners
FOR SELECT
TO authenticated
USING (
  active = true
  AND (
    'all' = ANY(target_roles)
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = ANY(target_roles::user_role[])
  )
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

CREATE POLICY "Admins can manage all banners"
ON public.announcement_banners
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updating complaints updated_at
CREATE TRIGGER update_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default system settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
('discount_threshold_days', '30', 'Auto-discount products expiring within X days'),
('min_discount_percent', '10', 'Minimum discount percentage allowed'),
('max_discount_percent', '70', 'Maximum discount percentage allowed'),
('auto_approve_shops', 'false', 'Automatically approve shop registrations'),
('require_gst_for_shops', 'true', 'Require GST number for shop registration'),
('max_complaint_resolution_days', '7', 'Maximum days to resolve a complaint');