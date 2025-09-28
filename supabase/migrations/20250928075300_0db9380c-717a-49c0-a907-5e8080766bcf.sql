-- Add profile picture support to hs_users table
ALTER TABLE public.hs_users 
ADD COLUMN profile_picture_url text;

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-pictures', 'profile-pictures', true);

-- Create RLS policies for profile pictures storage
CREATE POLICY "Anyone can view profile pictures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can upload profile pictures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-pictures');

CREATE POLICY "Users can update profile pictures" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can delete profile pictures" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-pictures');