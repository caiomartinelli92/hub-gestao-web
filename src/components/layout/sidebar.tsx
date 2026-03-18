'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

interface NavItem {
  label: string;
  href: string;
  roles: Role[];
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', roles: [Role.CEO, Role.PO, Role.DEV, Role.QA, Role.ADM], icon: '📊' },
  { label: 'Projetos', href: '/projetos', roles: [Role.CEO, Role.PO, Role.DEV, Role.QA], icon: '📁' },
  { label: 'Clientes', href: '/clientes', roles: [Role.CEO, Role.PO], icon: '🏢' },
  { label: 'Reuniões',   href: '/reunioes',   roles: [Role.CEO, Role.PO, Role.DEV, Role.QA, Role.ADM], icon: '📅' },
  { label: 'Calendário', href: '/calendario', roles: [Role.CEO, Role.PO, Role.DEV, Role.QA, Role.ADM], icon: '🗓️' },
  { label: 'Administrativo', href: '/administrativo', roles: [Role.CEO, Role.ADM], icon: '🏛️' },
  { label: 'Configurações',  href: '/configuracoes',  roles: [Role.CEO],          icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const filteredItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <aside data-sidebar className="w-60 bg-[#1a1a2e] min-h-screen flex flex-col border-r border-gray-800">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#8B0000] rounded-lg flex items-center justify-center text-white text-sm font-bold">
            H
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Hub de Gestão</h1>
            <p className="text-xs text-gray-500">Software House</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-[#8B0000] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60',
              )}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-gray-800">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="text-gray-500 hover:text-red-400 transition-colors text-xs"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
