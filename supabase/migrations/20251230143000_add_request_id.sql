-- Add personnel_request_id column to project_assignments table
ALTER TABLE project_assignments 
ADD COLUMN IF NOT EXISTS personnel_request_id UUID REFERENCES personnel_requests(id);

-- Optional: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_assignments_request_id ON project_assignments(personnel_request_id);
