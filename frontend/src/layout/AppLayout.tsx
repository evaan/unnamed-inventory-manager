import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Package, LayoutDashboard, Settings, User, LogOut } from 'lucide-react';

export default function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Add real auth cleanup here later
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center gap-2 border-b border-gray-100">
          <Package className="w-7 h-7 text-indigo-600" />
          <span className="font-bold text-lg tracking-wide">StockPulse</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/app"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link
            to="/app/account"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <User className="w-5 h-5" />
            Account
          </Link>
          <Link
            to="/app/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-800">Inventory Management</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Admin User</span>
            <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
              AU
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}