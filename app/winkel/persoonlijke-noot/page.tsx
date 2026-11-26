import { redirect } from 'next/navigation';
import { getCurrentProfile } from '../../lib/auth/session';
import { canViewNo } from './access';
import { localDate } from './model';
import PickupClient from './PickupClient';
export const dynamic='force-dynamic';
export default async function Page() {
  const profile=await getCurrentProfile();
  if(!profile)redirect('/login');if(!canViewNo(profile))redirect('/');
  return <PickupClient initialYear={localDate().slice(0,4)} today={localDate()}/>;
}
