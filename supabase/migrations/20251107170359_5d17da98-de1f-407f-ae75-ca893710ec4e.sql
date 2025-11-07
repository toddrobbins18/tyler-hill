-- Add new tag types for heads of sides
ALTER TYPE tag_type ADD VALUE IF NOT EXISTS 'head_of_girls_side';
ALTER TYPE tag_type ADD VALUE IF NOT EXISTS 'head_of_boys_side';