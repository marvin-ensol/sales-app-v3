-- Reset list_exit_date and exit_processed_at for list 3298 to allow reprocessing
UPDATE public.hs_list_memberships
SET 
  list_exit_date = NULL,
  exit_processed_at = NULL
WHERE 
  hs_list_id = '3298'
  AND list_exit_date IS NOT NULL;