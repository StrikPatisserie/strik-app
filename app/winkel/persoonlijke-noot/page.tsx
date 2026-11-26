import { redirect } from 'next/navigation';
import { getCurrentProfile } from '../../lib/auth/session';
import { canViewNo } from './access';
import { localDate } from './model';
import { seasonForDate } from './supplierCsv';
import PickupClient from './PickupClient';
export const dynamic='force-dynamic';
export default async function Page() {
  const profile=await getCurrentProfile();
  if(!profile)redirect('/login');if(!canViewNo(profile))redirect('/');
  return <PickupClient initialYear={seasonForDate(localDate())} today={localDate()}/>;
}
