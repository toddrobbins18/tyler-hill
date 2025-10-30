-- Add foreign key from health_center_admissions.child_id to children.id
ALTER TABLE health_center_admissions 
ADD CONSTRAINT fk_health_center_admissions_child_id 
FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;

-- Add foreign key from health_center_admissions.admitted_by to auth.users.id
ALTER TABLE health_center_admissions 
ADD CONSTRAINT fk_health_center_admissions_admitted_by 
FOREIGN KEY (admitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add foreign key from health_center_admissions.checked_out_by to auth.users.id
ALTER TABLE health_center_admissions 
ADD CONSTRAINT fk_health_center_admissions_checked_out_by 
FOREIGN KEY (checked_out_by) REFERENCES auth.users(id) ON DELETE SET NULL;