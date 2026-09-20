import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/facilities')({ beforeLoad: () => { throw redirect({ to: '/gallery' }); } });
