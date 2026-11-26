import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  Calendar,
  ChevronDown,
  CreditCard,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Send,
  Settings,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { RecouvrixLogo } from '../brand/RecouvrixLogo';
import { formatDate } from '../../design-system/formatters';
import {
  NAVIGATION_ITEMS,
  NavigationItemConfig,
  NavigationSectionId,
  SIDEBAR_NAVIGATION_GROUPS,
} from '../../design-system/tokens';
import type { AuthUser } from '../../types/auth';
import { CommandPalette } from './CommandPalette';

const NAV_ICONS: Record<NavigationSectionId, React.ComponentType<{ className?: string }>> = {
  supervision: Activity,
  users: UserCog,
  dashboard: LayoutDashboard,
  clients: Users,
  invoices: FileText,
  imports: FileSpreadsheet,
  reminders: Send,
  payments: CreditCard,
  history: History,
  settings: Settings,
};

const GROUP_LABELS: Record<NavigationItemConfig['group'], string> = {
  pilotage: 'Pilotage',
  operations: 'Recouvrement',
  administration: 'Administration & Audit',
  fondation: 'Référentiel visuel',
};

export interface AppShellNotification {
  id: string;
  title: string;
  detail: string;
  targetSection?: NavigationSectionId;
  targetFilter?: string;
}

export interface AppShellProps {
  user: AuthUser;
  activeSection: NavigationSectionId;
  onSelectSection: (section: NavigationSectionId, filter?: string) => void;
  onLogout: () => void;
  loggingOut?: boolean;
  notifications?: AppShellNotification[];
  pageTitle: string;
  pageSubtitle?: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  activeSection,
  onSelectSection,
  onLogout,
  loggingOut = false,
  notifications = [],
  pageTitle,
  pageSubtitle,
  primaryAction,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const roleLabel = user.role === 'ADMIN' ? 'Administrateur' : 'Gestionnaire';
  const initials = getInitials(user.fullName);
  const todayLabel = formatDate(new Date());

  const unreadNotifications = notifications.filter((n) => !readIds.includes(n.id));

  const allowedItems = NAVIGATION_ITEMS.filter((item) =>
    item.allowedRoles.includes(user.role)
  );

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const handleCommandPalette = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleCommandPalette);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleCommandPalette);
    };
  }, []);

  const handleSelectNav = (id: NavigationSectionId, filter?: string) => {
    onSelectSection(id, filter);
    setMobileMenuOpen(false);
  };

  const groups = SIDEBAR_NAVIGATION_GROUPS;

  const defaultHomeSection: NavigationSectionId =
    user.role === 'ADMIN' ? 'supervision' : 'dashboard';

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--color-sidebar)] text-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[var(--color-sidebar-border)] shrink-0">
        <button
          type="button"
          onClick={() => handleSelectNav(defaultHomeSection)}
          className="text-left rounded-md focus-visible:outline-white"
          aria-label="Accueil espace connecté Recouvrix"
        >
          <RecouvrixLogo variant="dark" size="sm" />
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fermer le menu de navigation"
          className="lg:hidden p-2 -mr-2 rounded-md text-slate-300 hover:text-white hover:bg-[var(--color-sidebar-hover)]"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((groupKey) => {
          const items = allowedItems.filter((item) => item.group === groupKey);
          if (items.length === 0) return null;
          return (
            <div key={groupKey} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400">
                {GROUP_LABELS[groupKey]}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = NAV_ICONS[item.id];
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectNav(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-3 min-h-[40px] rounded-md text-[14px] font-medium text-left transition-colors duration-150 ${
                          isActive
                            ? 'bg-[var(--color-sidebar-active)] text-white'
                            : 'text-slate-300 hover:bg-[var(--color-sidebar-hover)] hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`w-[18px] h-[18px] shrink-0 ${
                            isActive ? 'text-blue-300' : 'text-slate-400'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--color-sidebar-border)] space-y-3 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-8 h-8 rounded-md bg-[var(--color-sidebar-active)] border border-slate-600/60 flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white truncate">{user.fullName}</p>
            <p className="text-[12px] text-slate-400 truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2.5 px-3 min-h-[36px] rounded-md text-[13px] font-medium text-slate-300 hover:bg-[var(--color-sidebar-hover)] hover:text-white transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-[var(--color-sidebar-border)]">
        <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full shadow-xl z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-[var(--color-border)] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu de navigation"
              className="lg:hidden p-2 -ml-2 rounded-md text-[var(--color-ink-secondary)] hover:bg-slate-100 hover:text-[var(--color-ink)]"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-[13px] min-w-0">
              <span className="hidden sm:inline text-[var(--color-ink-muted)] whitespace-nowrap">
                Recouvrix
              </span>
              <span
                className="hidden sm:inline text-slate-300 select-none"
                aria-hidden="true"
              >
                /
              </span>
              <span className="font-display font-semibold text-[15px] text-[var(--color-ink)] truncate">
                {pageTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Recherche universelle */}
            <button
              type="button"
              onClick={() => {
                setCommandPaletteOpen(true);
                setProfileMenuOpen(false);
                setNotificationsOpen(false);
              }}
              aria-label="Ouvrir la recherche universelle"
              className="hidden sm:inline-flex items-center gap-2 min-h-[40px] pl-3 pr-2 rounded-md border border-[var(--color-border)] bg-white text-[13px] text-[var(--color-ink-muted)] hover:bg-slate-50 hover:text-[var(--color-ink)] transition-colors"
            >
              <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline max-w-[180px] truncate">Rechercher FAC, client…</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-ink-muted)]">
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-canvas)] px-1">⌘</kbd>
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-canvas)] px-1">K</kbd>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Recherche universelle"
              className="sm:hidden min-w-[40px] min-h-[40px] rounded-md border border-[var(--color-border)] bg-white text-[var(--color-ink-secondary)] hover:bg-slate-50 inline-flex items-center justify-center"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Date du jour */}
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[var(--color-ink-muted)] tabular-amount whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{todayLabel}</span>
            </div>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setProfileMenuOpen(false);
                }}
                aria-expanded={notificationsOpen}
                aria-label={`Notifications (${unreadNotifications.length} à consulter)`}
                className="relative min-w-[40px] min-h-[40px] px-2.5 rounded-md border border-[var(--color-border)] bg-white text-[var(--color-ink-secondary)] hover:bg-slate-50 hover:text-[var(--color-ink)] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadNotifications.length > 0 && (
                  <span className="tabular-amount text-[11px] font-semibold text-[var(--color-primary)]">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                      Alertes de recouvrement
                    </span>
                    {unreadNotifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setReadIds(notifications.map((n) => n.id))}
                        className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                      >
                        Tout marquer comme lu
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-5 text-center text-[13px] text-[var(--color-ink-muted)]">
                      Aucune alerte prioritaire à signaler.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
                      {notifications.map((item) => {
                        const isRead = readIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setReadIds((prev) =>
                                prev.includes(item.id) ? prev : [...prev, item.id]
                              );
                              setNotificationsOpen(false);
                              if (item.targetSection) {
                                handleSelectNav(item.targetSection, item.targetFilter);
                              }
                            }}
                            className={`w-full text-left px-4 py-3 space-y-1 hover:bg-slate-50 transition-colors ${
                              isRead ? 'bg-white' : 'bg-[var(--color-primary-soft)]/50'
                            }`}
                          >
                            <p className="text-[13px] font-medium text-[var(--color-ink)]">
                              {item.title}
                            </p>
                            <p className="text-[12px] text-[var(--color-ink-secondary)] leading-relaxed">
                              {item.detail}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profil utilisateur */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileMenuOpen}
                className="min-h-[40px] px-2.5 sm:px-3 rounded-md border border-[var(--color-border)] bg-white hover:bg-slate-50 inline-flex items-center gap-2 text-[13px] transition-colors"
              >
                <span className="w-6 h-6 rounded bg-[var(--color-sidebar)] text-white text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span className="hidden sm:inline font-medium text-[var(--color-ink)] whitespace-nowrap">
                  {user.fullName}
                </span>
                <span className="hidden xl:inline text-[12px] text-[var(--color-ink-muted)] whitespace-nowrap">
                  · {roleLabel}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-0.5">
                    <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">
                      {user.fullName}
                    </p>
                    <p className="text-[12px] text-[var(--color-ink-muted)] truncate">
                      {user.email}
                    </p>
                    <p className="text-[12px] font-medium text-[var(--color-primary)] pt-0.5">
                      Rôle : {roleLabel}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      disabled={loggingOut}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 rounded text-[13px] font-medium text-left text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] flex items-center gap-2 disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1240px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
              <div className="space-y-1 min-w-0">
                <h1 className="font-display text-[22px] sm:text-[26px] font-bold text-[var(--color-ink)] leading-tight">
                  {pageTitle}
                </h1>
                {pageSubtitle && (
                  <p className="text-[14px] text-[var(--color-ink-muted)] max-w-2xl leading-relaxed">
                    {pageSubtitle}
                  </p>
                )}
              </div>
              {primaryAction && <div className="shrink-0">{primaryAction}</div>}
            </div>

            {children}
          </div>
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(section, filter) => {
          setCommandPaletteOpen(false);
          onSelectSection(section, filter);
        }}
      />
    </div>
  );
};
