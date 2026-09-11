import type { Metadata } from 'next';
import { OrderStatus } from '@/components/owner-order-status';
import './order.css';
export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };
export default function OrderPage() { return <OrderStatus />; }
