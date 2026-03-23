
-- Add capacity column to electives table
ALTER TABLE public.electives ADD COLUMN capacity integer NULL DEFAULT NULL;

-- Insert electives for Timber Lake Camp
INSERT INTO public.electives (company_id, name, capacity) VALUES
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', '3D Printing', 8),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Candles', 8),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Ceramics', 10),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Graphic Design', 6),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Insta-Art', 10),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Jewelry', 10),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Music Studio', 8),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Painting', 10),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Photography', 6),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Radio/Podcasting', 5),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Robotics', 6),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Stitchery', 8),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'TV Studio', 8),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Water Ski', 8),
  ('1d296ccf-31e1-4176-af57-50a4a4820f82', 'Woodshop', 8);
