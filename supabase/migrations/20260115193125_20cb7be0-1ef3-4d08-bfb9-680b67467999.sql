-- Create bunks table to track bunk assignments for staff
CREATE TABLE public.bunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  bunk_number INTEGER NOT NULL,
  bunk_name TEXT,
  division_id UUID REFERENCES public.divisions(id),
  season TEXT DEFAULT '2025',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, bunk_number, season)
);

-- Create bunk_staff to map staff to bunks
CREATE TABLE public.bunk_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  bunk_id UUID REFERENCES public.bunks(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  season TEXT DEFAULT '2025',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(bunk_id, staff_id, season)
);

-- Create staff_days_off table for OD management
CREATE TABLE public.staff_days_off (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  is_day_off BOOLEAN DEFAULT true,
  is_night_off BOOLEAN DEFAULT false,
  is_sleeping_out BOOLEAN DEFAULT false,
  checked_out BOOLEAN DEFAULT false,
  checked_out_at TIMESTAMP WITH TIME ZONE,
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  season TEXT DEFAULT '2025',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, staff_id, date, season)
);

-- Create appointments table for camper/staff appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  appointment_type TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME,
  provider_name TEXT,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  outcome TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  season TEXT DEFAULT '2025',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT appointment_person_check CHECK (
    (child_id IS NOT NULL AND staff_id IS NULL) OR 
    (child_id IS NULL AND staff_id IS NOT NULL)
  )
);

-- Enable RLS on all tables
ALTER TABLE public.bunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bunk_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_days_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bunks
CREATE POLICY "Users can view bunks for their company"
ON public.bunks FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage bunks for their company"
ON public.bunks FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RLS Policies for bunk_staff
CREATE POLICY "Users can view bunk_staff for their company"
ON public.bunk_staff FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage bunk_staff for their company"
ON public.bunk_staff FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RLS Policies for staff_days_off
CREATE POLICY "Users can view staff_days_off for their company"
ON public.staff_days_off FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage staff_days_off for their company"
ON public.staff_days_off FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RLS Policies for appointments
CREATE POLICY "Users can view appointments for their company"
ON public.appointments FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage appointments for their company"
ON public.appointments FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_bunks_updated_at
BEFORE UPDATE ON public.bunks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_days_off_updated_at
BEFORE UPDATE ON public.staff_days_off
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for these tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'staff_days_off'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_days_off;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $$;