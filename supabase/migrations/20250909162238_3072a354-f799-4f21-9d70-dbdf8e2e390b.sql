-- Add order column to task_categories table
ALTER TABLE public.task_categories 
ADD COLUMN order_column INTEGER;

-- Set initial order values for existing categories
UPDATE public.task_categories 
SET order_column = CASE 
  WHEN hs_queue_id = '22933271' THEN 1  -- Rappels & RDV
  WHEN hs_queue_id = '22859489' THEN 2  -- New  
  WHEN hs_queue_id = '22934016' THEN 3  -- Simulations
  WHEN hs_queue_id = '22934015' THEN 4  -- Communications
  WHEN hs_queue_id = '22859490' THEN 5  -- Attempted
  WHEN hs_queue_id = 'other' THEN 6     -- Autres
  ELSE 999 -- Default for any unknown categories
END;

-- Make order_column NOT NULL after setting values
ALTER TABLE public.task_categories 
ALTER COLUMN order_column SET NOT NULL;

-- Add unique constraint to prevent duplicate orders
ALTER TABLE public.task_categories 
ADD CONSTRAINT unique_order_column UNIQUE (order_column);

-- Drop and recreate the get_task_categories function with new signature
DROP FUNCTION public.get_task_categories();

CREATE OR REPLACE FUNCTION public.get_task_categories()
 RETURNS TABLE(id bigint, label text, color text, hs_queue_id text, order_column integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.label, tc.color, tc.hs_queue_id, tc.order_column
  FROM task_categories tc
  ORDER BY tc.order_column;
END;
$function$