-- Fix search_path security warnings for the two new notification functions

ALTER FUNCTION notify_tutoring_therapy() SET search_path = public, pg_temp;
ALTER FUNCTION notify_sports_academy() SET search_path = public, pg_temp;