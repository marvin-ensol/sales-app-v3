-- Create the error_logs table for structured error tracking
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  context TEXT NOT NULL,
  error_type TEXT NOT NULL,
  endpoint TEXT,
  status_code INTEGER,
  response_error TEXT,
  response_message TEXT
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated access
CREATE POLICY "Allow all operations on error_logs"
ON public.error_logs
FOR ALL
USING (true);

-- Create indexes for common queries
CREATE INDEX idx_error_logs_context ON public.error_logs(context);
CREATE INDEX idx_error_logs_error_type ON public.error_logs(error_type);
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_status_code ON public.error_logs(status_code);