import { supabase } from './supabase';

export type Gym = {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Simple in-process cache — survives for the lifetime of the JS bundle
let cache: Gym[] | null = null;

export async function fetchGyms(): Promise<Gym[]> {
  if (cache) return cache;
  const { data, error } = await supabase.from('gyms').select('id,name,address,neighborhood,city,latitude,longitude').order('id');
  if (error || !data) return [];
  cache = data as Gym[];
  return cache;
}

/** Synchronous lookup — only call after fetchGyms() has resolved */
export function gymName(gyms: Gym[], id: string): string {
  return gyms.find(g => g.id === id)?.name ?? `Gym ${id}`;
}
