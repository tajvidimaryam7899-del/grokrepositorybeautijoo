'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import { ProfileStepper, type WizardStep } from '@/components/profile/stepper';
import {
  fetchMyProfessional, updateMyProfessional, addMyLocation, setMyWorkingHours,
  fetchPublicServices, upsertMyService, publishMyProfessional,
  uploadMyMedia, fetchCategories, resolveMediaUrl,
  type OwnProfessional, type ProfileCompletion,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { IRAN_PROVINCES, citiesOf, type IranCity } from '@/lib/geo/iran-provinces';
import LocationMapPicker, { type MapPosition } from '@/components/location/location-map-picker';

const STEPS: WizardStep[] = [
  { id: 'basic', label: '\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u067e\u0627\u06cc\u0647' },
  { id: 'contact', label: '\u0645\u0639\u0631\u0641\u06cc' },
  { id: 'media', label: '\u062a\u0635\u0627\u0648\u06cc\u0631' },
  { id: 'location', label: '\u0645\u0648\u0642\u0639\u06cc\u062a' },
  { id: 'services', label: '\u062a\u062e\u0635\u0635\u200c\u0647\u0627' },
  { id: 'hours', label: '\u0633\u0627\u0639\u0627\u062a \u06a9\u0627\u0631\u06cc' },
  { id: 'review', label: '\u0628\u0631\u0631\u0633\u06cc \u0646\u0647\u0627\u06cc\u06cc' },
];

export default function ProfileCompletePage() {
  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-coral">\u062a\u06a9\u0645\u06cc\u0644 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644</h1>
      <p className="text-sm text-gray">\u062f\u0631 \u062d\u0627\u0644 \u0628\u0647\u200c\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc \u0628\u062e\u0634 \u0645\u0648\u0642\u0639\u06cc\u062a. \u0644\u0637\u0641\u0627\u064b \u0686\u0646\u062f \u062f\u0642\u06cc\u0642\u0647 \u062f\u06cc\u06af\u0631 \u062a\u0627\u0632\u0647 \u06a9\u0646\u06cc\u062f.</p>
    </div>
  );
}
