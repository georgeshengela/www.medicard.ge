import React, { useLayoutEffect } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { VisitEditorScreen } from '@/components/visits/VisitEditorScreen';
import { ka } from '@/i18n/ka';

export default function VisitEditorRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      title: id ? ka.visits.editTitle : ka.visits.addTitle,
    });
  }, [navigation, id]);

  return <VisitEditorScreen visitId={typeof id === 'string' ? id : undefined} />;
}
