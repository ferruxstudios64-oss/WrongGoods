import type { Metadata } from 'next';
import { OwnerInbox } from '@/components/owner-inbox';
import '../owner.css';
export const metadata: Metadata = { title: 'Owner inbox', robots: { index: false, follow: false } };
export default function InboxPage() { return <OwnerInbox />; }
