-- Ensure full row data for realtime updates
ALTER TABLE public.shops REPLICA IDENTITY FULL;