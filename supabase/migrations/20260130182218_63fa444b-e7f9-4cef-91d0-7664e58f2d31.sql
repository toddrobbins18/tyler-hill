-- Create kanban_notes table for dashboard kanban board
CREATE TABLE public.kanban_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  column_status TEXT NOT NULL DEFAULT 'todo' CHECK (column_status IN ('todo', 'in_progress', 'done')),
  title TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  season TEXT NOT NULL DEFAULT '2026'
);

-- Enable RLS
ALTER TABLE public.kanban_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view kanban notes from their company"
ON public.kanban_notes
FOR SELECT
USING ((company_id = get_user_company(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins and staff can manage kanban notes for their company"
ON public.kanban_notes
FOR ALL
USING ((company_id = get_user_company(auth.uid())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_kanban_notes_updated_at
BEFORE UPDATE ON public.kanban_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();