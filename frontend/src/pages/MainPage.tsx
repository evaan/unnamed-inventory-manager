import React, { useState, useRef, useEffect } from 'react';
import { 
  PanelLeftClose, PanelLeftOpen, Sparkles 
} from 'lucide-react';

interface MainPageProps {
  token: string;
  onLogout: () => void;
}

export const MainPage = ({ token, onLogout }: MainPageProps) => {
  
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 180 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {}
      <aside
        ref={sidebarRef}
        style={{ width: isCollapsed ? '72px' : `${sidebarWidth}px` }}
        className={`relative bg-slate-900 border-r border-slate-800 flex flex-col transition-[width] duration-75 select-none z-20`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight truncate bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                SideList Workspace
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors mx-auto"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          
        </div>

        {!isCollapsed && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group flex items-center justify-center hover:bg-indigo-500/50 transition-colors"
            title="Drag to resize"
          >
            <div className="w-0.5 h-8 bg-slate-700 group-hover:bg-indigo-400 rounded-full" />
          </div>
        )}
      </aside>

      {}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
          </div>
          <div className="flex items-center space-x-3">
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
          <div className="max-w-md w-full p-8 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl text-center">
            <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
