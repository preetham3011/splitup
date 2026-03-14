import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import { mockUser } from '@/lib/mock-data';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout() {
  const { user } = useAuth();
  
  // Use authenticated user if available, fallback to mock user
  const currentUser = user || mockUser;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar user={currentUser} />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
