-- Allow Project Managers to update status of requests they manage
CREATE POLICY "PMs can update their project requests"
ON technical_service_requests
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  AND project_id IN (
    SELECT project_id FROM project_managers WHERE manager_id = auth.uid()
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  AND project_id IN (
    SELECT project_id FROM project_managers WHERE manager_id = auth.uid()
  )
);

-- Allow Project Managers to update status of bids for requests they manage
CREATE POLICY "PMs can update bids for their project requests"
ON technical_service_bids
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  AND request_id IN (
    SELECT id FROM technical_service_requests
    WHERE project_id IN (
      SELECT project_id FROM project_managers WHERE manager_id = auth.uid()
    )
  )
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  AND request_id IN (
    SELECT id FROM technical_service_requests
    WHERE project_id IN (
      SELECT project_id FROM project_managers WHERE manager_id = auth.uid()
    )
  )
);
