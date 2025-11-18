-- Add health_center role to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'health_center';