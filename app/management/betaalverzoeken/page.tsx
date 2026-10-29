import { requireAdminProfile } from '../../lib/auth/session';
import PaymentRequests from './PaymentRequestsDashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Betaalverzoeken · Strik',robots:{index:false,follow:false}};
export default async function PaymentRequestsPage(){await requireAdminProfile();return <PaymentRequests/>;}
