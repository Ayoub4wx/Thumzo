-- SQL Schema for Thumbnail Studio
-- Run this in your Supabase SQL Editor

-- 1. Profiles table (linked to Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 2. Assets table (uploaded images)
CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" 
  ON assets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets" 
  ON assets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" 
  ON assets FOR DELETE 
  USING (auth.uid() = user_id);

-- 3. Generations table (AI generated thumbnails)
CREATE TABLE IF NOT EXISTS generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  urls TEXT[] NOT NULL, -- Array of image URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations" 
  ON generations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations" 
  ON generations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generations" 
  ON generations FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. Drafts table (saved editor states)
CREATE TABLE IF NOT EXISTS drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Untitled Draft',
  data JSONB NOT NULL, -- Editor state (layers, settings, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for drafts
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own drafts" 
  ON drafts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts" 
  ON drafts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts" 
  ON drafts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts" 
  ON drafts FOR DELETE 
  USING (auth.uid() = user_id);
