import type { Metadata } from 'next';
import { OwnerStudio } from '@/components/owner-studio';
import './owner.css';

export const metadata: Metadata = { title: 'Owner studio', robots: { index: false, follow: false } };
export default function OwnerPage() { return <OwnerStudio />; }
