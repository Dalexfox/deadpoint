import { supabase } from './supabase';

export type Gym = {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url?: string | null;  // optional hero/background photo (gyms.image_url); customizable in Supabase
};

// Simple in-process cache — survives for the lifetime of the JS bundle
let cache: Gym[] | null = null;

export async function fetchGyms(): Promise<Gym[]> {
  if (cache) return cache;
  // select('*') is tolerant — works whether or not the image_url column exists yet.
  const { data, error } = await supabase.from('gyms').select('*').order('id');
  if (error || !data) return [];
  cache = data as Gym[];
  return cache;
}

/** Synchronous lookup — only call after fetchGyms() has resolved */
export function gymName(gyms: Gym[], id: string): string {
  return gyms.find(g => g.id === id)?.name ?? `Gym ${id}`;
}
