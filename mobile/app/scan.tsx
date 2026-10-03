import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScanChat } from '@/components/scan/ScanChat';
import { scanKindFromParam } from '@/lib/scanThread';
import { useAuth } from '@/store/AuthContext';

/** MEDISCAN: lab results, imaging and skin photos in one chat. ?type=lab|imaging|skin preselects the choice. */
export default function ScanScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ type?: string }>();
  if (!user) return null;
  const kind = scanKindFromParam(params.type);
  return <ScanChat key={`${user.id}:${kind ?? 'any'}`} owner={user.id} initialKind={kind} />;
}
