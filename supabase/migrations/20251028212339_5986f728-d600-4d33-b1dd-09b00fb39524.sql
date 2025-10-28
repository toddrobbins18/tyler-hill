-- Seed default role permissions for all menu items
-- This ensures every role has proper access control from the start

-- First, let's make sure we have all the menu items defined
-- Admin gets access to everything
INSERT INTO public.role_permissions (role, menu_item, can_access)
VALUES 
  ('admin', 'dashboard', true),
  ('admin', 'roster', true),
  ('admin', 'staff', true),
  ('admin', 'nurse', true),
  ('admin', 'menu', true),
  ('admin', 'special-meals', true),
  ('admin', 'rainy-day', true),
  ('admin', 'evaluation-questions', true),
  ('admin', 'role-permissions', true),
  ('admin', 'division-permissions', true),
  ('admin', 'transportation', true),
  ('admin', 'notes', true),
  ('admin', 'awards', true),
  ('admin', 'incidents', true),
  ('admin', 'calendar', true),
  ('admin', 'sports-calendar', true),
  ('admin', 'activities', true),
  ('admin', 'special-events', true),
  ('admin', 'sports-academy', true),
  ('admin', 'tutoring-therapy', true),
  ('admin', 'messages', true),
  ('admin', 'admin', true),
  ('admin', 'user-approvals', true)
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = true;

-- Staff gets access to most pages except admin pages
INSERT INTO public.role_permissions (role, menu_item, can_access)
VALUES 
  ('staff', 'dashboard', true),
  ('staff', 'roster', true),
  ('staff', 'staff', false),
  ('staff', 'nurse', true),
  ('staff', 'menu', true),
  ('staff', 'special-meals', true),
  ('staff', 'rainy-day', true),
  ('staff', 'evaluation-questions', false),
  ('staff', 'role-permissions', false),
  ('staff', 'division-permissions', false),
  ('staff', 'transportation', true),
  ('staff', 'notes', true),
  ('staff', 'awards', true),
  ('staff', 'incidents', true),
  ('staff', 'calendar', true),
  ('staff', 'sports-calendar', true),
  ('staff', 'activities', true),
  ('staff', 'special-events', true),
  ('staff', 'sports-academy', true),
  ('staff', 'tutoring-therapy', true),
  ('staff', 'messages', true),
  ('staff', 'admin', false),
  ('staff', 'user-approvals', false)
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

-- Division leaders get access to their division's data
INSERT INTO public.role_permissions (role, menu_item, can_access)
VALUES 
  ('division_leader', 'dashboard', true),
  ('division_leader', 'roster', true),
  ('division_leader', 'staff', false),
  ('division_leader', 'nurse', true),
  ('division_leader', 'menu', true),
  ('division_leader', 'special-meals', true),
  ('division_leader', 'rainy-day', true),
  ('division_leader', 'evaluation-questions', false),
  ('division_leader', 'role-permissions', false),
  ('division_leader', 'division-permissions', false),
  ('division_leader', 'transportation', true),
  ('division_leader', 'notes', true),
  ('division_leader', 'awards', true),
  ('division_leader', 'incidents', true),
  ('division_leader', 'calendar', true),
  ('division_leader', 'sports-calendar', true),
  ('division_leader', 'activities', true),
  ('division_leader', 'special-events', true),
  ('division_leader', 'sports-academy', true),
  ('division_leader', 'tutoring-therapy', true),
  ('division_leader', 'messages', true),
  ('division_leader', 'admin', false),
  ('division_leader', 'user-approvals', false)
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

-- Specialists get access to all divisions for specialized pages
INSERT INTO public.role_permissions (role, menu_item, can_access)
VALUES 
  ('specialist', 'dashboard', true),
  ('specialist', 'roster', true),
  ('specialist', 'staff', false),
  ('specialist', 'nurse', true),
  ('specialist', 'menu', false),
  ('specialist', 'special-meals', false),
  ('specialist', 'rainy-day', false),
  ('specialist', 'evaluation-questions', false),
  ('specialist', 'role-permissions', false),
  ('specialist', 'division-permissions', false),
  ('specialist', 'transportation', true),
  ('specialist', 'notes', true),
  ('specialist', 'awards', true),
  ('specialist', 'incidents', true),
  ('specialist', 'calendar', true),
  ('specialist', 'sports-calendar', true),
  ('specialist', 'activities', true),
  ('specialist', 'special-events', true),
  ('specialist', 'sports-academy', true),
  ('specialist', 'tutoring-therapy', true),
  ('specialist', 'messages', true),
  ('specialist', 'admin', false),
  ('specialist', 'user-approvals', false)
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

-- Viewers get read-only access to basic pages
INSERT INTO public.role_permissions (role, menu_item, can_access)
VALUES 
  ('viewer', 'dashboard', true),
  ('viewer', 'roster', true),
  ('viewer', 'staff', false),
  ('viewer', 'nurse', false),
  ('viewer', 'menu', true),
  ('viewer', 'special-meals', true),
  ('viewer', 'rainy-day', true),
  ('viewer', 'evaluation-questions', false),
  ('viewer', 'role-permissions', false),
  ('viewer', 'division-permissions', false),
  ('viewer', 'transportation', true),
  ('viewer', 'notes', true),
  ('viewer', 'awards', true),
  ('viewer', 'incidents', false),
  ('viewer', 'calendar', true),
  ('viewer', 'sports-calendar', true),
  ('viewer', 'activities', true),
  ('viewer', 'special-events', true),
  ('viewer', 'sports-academy', false),
  ('viewer', 'tutoring-therapy', false),
  ('viewer', 'messages', true),
  ('viewer', 'admin', false),
  ('viewer', 'user-approvals', false)
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;