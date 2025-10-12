-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'staff',
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create children table
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  age INTEGER,
  grade TEXT,
  group_name TEXT,
  status TEXT DEFAULT 'active',
  guardian_email TEXT,
  guardian_phone TEXT,
  allergies TEXT,
  medical_notes TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create awards/achievements table
CREATE TABLE public.awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES public.children ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create incident reports table
CREATE TABLE public.incident_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES public.children ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT,
  reported_by TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staff table
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  status TEXT DEFAULT 'active',
  email TEXT,
  phone TEXT,
  hire_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staff evaluations table
CREATE TABLE public.staff_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES public.staff ON DELETE CASCADE,
  date DATE NOT NULL,
  rating DECIMAL(3,2),
  evaluator TEXT,
  comments TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trips table
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  destination TEXT,
  date DATE NOT NULL,
  departure_time TEXT,
  return_time TEXT,
  chaperone TEXT,
  capacity INTEGER,
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily notes table
CREATE TABLE public.daily_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES public.children ON DELETE CASCADE,
  date DATE NOT NULL,
  mood TEXT,
  activities TEXT,
  meals TEXT,
  nap TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create menu items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  items TEXT NOT NULL,
  allergens TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  location TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.profiles ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for children (authenticated users can view/manage)
CREATE POLICY "Authenticated users can view children" ON public.children FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert children" ON public.children FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update children" ON public.children FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete children" ON public.children FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for awards
CREATE POLICY "Authenticated users can view awards" ON public.awards FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage awards" ON public.awards FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for incident reports
CREATE POLICY "Authenticated users can view incidents" ON public.incident_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage incidents" ON public.incident_reports FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for staff
CREATE POLICY "Authenticated users can view staff" ON public.staff FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage staff" ON public.staff FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for staff evaluations
CREATE POLICY "Authenticated users can view evaluations" ON public.staff_evaluations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage evaluations" ON public.staff_evaluations FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for trips
CREATE POLICY "Authenticated users can view trips" ON public.trips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage trips" ON public.trips FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for daily notes
CREATE POLICY "Authenticated users can view daily notes" ON public.daily_notes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage daily notes" ON public.daily_notes FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for menu items
CREATE POLICY "Authenticated users can view menu" ON public.menu_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage menu" ON public.menu_items FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for events
CREATE POLICY "Authenticated users can view events" ON public.events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage events" ON public.events FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for messages
CREATE POLICY "Users can view their messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their received messages" ON public.messages FOR UPDATE USING (auth.uid() = recipient_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();