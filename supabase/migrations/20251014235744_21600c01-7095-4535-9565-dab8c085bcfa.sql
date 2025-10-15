-- Create special_meals table (similar to menu_items)
CREATE TABLE IF NOT EXISTS public.special_meals (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  items TEXT NOT NULL,
  allergens TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create rainy_day_schedule table (similar to trips)
CREATE TABLE IF NOT EXISTS public.rainy_day_schedule (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  location TEXT,
  activity_type TEXT NOT NULL,
  capacity INTEGER,
  supervisor TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add recurring dosage fields to medication_logs
ALTER TABLE public.medication_logs
ADD COLUMN IF NOT EXISTS frequency TEXT,
ADD COLUMN IF NOT EXISTS days_of_week TEXT[],
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE public.special_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rainy_day_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies for special_meals
CREATE POLICY "Everyone can view special meals"
ON public.special_meals
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and staff can manage special meals"
ON public.special_meals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- RLS policies for rainy_day_schedule
CREATE POLICY "Everyone can view rainy day schedule"
ON public.rainy_day_schedule
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and staff can manage rainy day schedule"
ON public.rainy_day_schedule
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Add realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_meals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rainy_day_schedule;