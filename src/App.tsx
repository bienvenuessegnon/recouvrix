import { useCallback, useEffect, useState } from 'react';
import {
  AppShell,
  AppShellNotification,
} from './components/layout/AppShell';
import { Button, ToastProvider, useToast } from './components/ui';
import { NAVIGATION_ITEMS, NavigationSectionId } from './design-system/tokens';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ImportsPage } from './pages/ImportsPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { RemindersPage } from './pages/RemindersPage';
import { SecurityLogsPage } from './pages/SecurityLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  authApi,
  getSessionToken,
  setSessionToken,
  setUnauthorizedHandler,
} from './services/api';
import type { AuthUser, UserRole } from './types/auth';

type RouteState =
  | { kind: 'landing' }
  | { kind: 'login' }
  | { kind: 'workspace'; section: NavigationSectionId; filter?: string };

function getDefaultSectionForRole(role: UserRole): NavigationSectionId {
  return role === 'ADMIN' ? 'supervision' : 'dashboard';
}

function parseLocation(location: Location): RouteState {
  const clean = location.pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') {
    return { kind: 'landing' };
  }
  if (clean === '/connexion') {
    return { kind: 'login' };
  }
  const matchedNav = NAVIGATION_ITEMS.find((item) => item.path === clean);
  if (matchedNav) {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filtre') || undefined;
    return { kind: 'workspace', section: matchedNav.id, filter };
  }
  return { kind: 'landing' };
}

function getUrlForRoute(route: RouteState): string {
  if (route.kind === 'landing') return '/';
  if (route.kind === 'login') return '/connexion';
  const nav = NAVIGATION_ITEMS.find((item) => item.id === route.section);
  const basePath = nav?.path ?? '/espace';
  if (route.filter) {
    return `${basePath}?filtre=${encodeURIComponent(route.filter)}`;
  }
  return basePath;
}

function AppContent() {
  const { notify } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [route, setRoute] = useState<RouteState>(() =>
    parseLocation(window.location)
  );
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState<AppShellNotification[]>([]);

  const navigateTo = useCallback((nextRoute: RouteState, replace = false) => {
    setRoute(nextRoute);
    const targetUrl = getUrlForRoute(nextRoute);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      if (replace) {
        window.history.replaceState(null, '', targetUrl);
      } else {
        window.history.pushState(null, '', targetUrl);
      }
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((reason) => {
      setUser(null);
      setSessionToken(null);
      setNotifications([]);
      setSessionNotice(
        reason || 'Votre session a expiré. Veuillez vous reconnecter.'
      );
      navigateTo({ kind: 'login' }, true);
    });
    return () => setUnauthorizedHandler(null);
  }, [navigateTo]);

  useEffect(() => {
    if (route.kind === 'workspace') {
      if (!user || !getSessionToken()) {
        setSessionNotice('Veuillez vous connecter pour accéder à cet espace.');
        navigateTo({ kind: 'login' }, true);
        return;
      }

      const navConfig = NAVIGATION_ITEMS.find((item) => item.id === route.section);
      if (!navConfig || !navConfig.allowedRoles.includes(user.role)) {
        notify({
          tone: 'error',
          title: 'Accès non autorisé',
          description: 'Vous ne disposez pas des droits nécessaires pour afficher cette page.',
        });
        navigateTo(
          { kind: 'workspace', section: getDefaultSectionForRole(user.role) },
          true
        );
      }
    }
  }, [route, user, navigateTo, notify]);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseLocation(window.location);
      if (parsed.kind === 'workspace' && (!user || !getSessionToken())) {
        setSessionNotice('Veuillez vous connecter pour accéder à cet espace.');
        navigateTo({ kind: 'login' }, true);
        return;
      }
      setRoute(parsed);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, navigateTo]);

  const handleLoginSuccess = (authenticatedUser: AuthUser) => {
    setUser(authenticatedUser);
    setSessionNotice(null);
    const defaultSection = getDefaultSectionForRole(authenticatedUser.role);
    navigateTo({ kind: 'workspace', section: defaultSection });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Déconnexion locale maintenue
    } finally {
      setSessionToken(null);
      setUser(null);
      setNotifications([]);
      setLoggingOut(false);
      navigateTo({ kind: 'login' });
      notify({
        tone: 'info',
        title: 'Session fermée',
        description: 'Vous avez été déconnecté en toute sécurité.',
      });
    }
  };

  if (route.kind === 'landing') {
    return (
      <LandingPage
        onNavigateToAuth={() => {
          if (user && getSessionToken()) {
            navigateTo({
              kind: 'workspace',
              section: getDefaultSectionForRole(user.role),
            });
          } else {
            navigateTo({ kind: 'login' });
          }
        }}
      />
    );
  }

  if (route.kind === 'login' || !user) {
    return (
      <LoginPage
        sessionNotice={sessionNotice}
        onClearNotice={() => setSessionNotice(null)}
        onBackToLanding={() => navigateTo({ kind: 'landing' })}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const activeSection = route.section;
  const activeFilter = route.filter;
  const currentModule =
    NAVIGATION_ITEMS.find((item) => item.id === activeSection) ?? NAVIGATION_ITEMS[0];
  const defaultSection = getDefaultSectionForRole(user.role);

  return (
    <AppShell
      user={user}
      activeSection={activeSection}
      onSelectSection={(section, filter) =>
        navigateTo({ kind: 'workspace', section, filter })
      }
      onLogout={handleLogout}
      loggingOut={loggingOut}
      notifications={notifications}
      pageTitle={currentModule.label}
      pageSubtitle={currentModule.description}
      primaryAction={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigateTo({ kind: 'landing' })}
        >
          Page d’accueil
        </Button>
      }
    >
      {(activeSection === 'supervision' || activeSection === 'dashboard') && (
        <DashboardPage
          user={user}
          onNavigate={(section, filter) =>
            navigateTo({ kind: 'workspace', section, filter })
          }
          onSyncNotifications={setNotifications}
        />
      )}

      {activeSection === 'clients' && (
        <ClientsPage
          initialFilter={activeFilter}
          onOpenInvoice={(invoiceId) =>
            navigateTo({
              kind: 'workspace',
              section: 'invoices',
              filter: `facture:${invoiceId}`,
            })
          }
        />
      )}

      {activeSection === 'invoices' && (
        <InvoicesPage
          initialFilter={activeFilter}
          onOpenClient={(clientId) =>
            navigateTo({
              kind: 'workspace',
              section: 'clients',
              filter: `client:${clientId}`,
            })
          }
          onNavigate={(section, filter) =>
            navigateTo({ kind: 'workspace', section, filter })
          }
        />
      )}

      {activeSection === 'imports' && (
        <ImportsPage
          initialFilter={activeFilter}
          onNavigateToInvoices={() =>
            navigateTo({ kind: 'workspace', section: 'invoices' })
          }
        />
      )}

      {activeSection === 'reminders' && (
        <RemindersPage
          initialFilter={activeFilter}
          onNavigateToInvoice={(invoiceId) =>
            navigateTo({
              kind: 'workspace',
              section: 'invoices',
              filter: `facture:${invoiceId}`,
            })
          }
          onNavigateToClient={(clientId) =>
            navigateTo({
              kind: 'workspace',
              section: 'clients',
              filter: `client:${clientId}`,
            })
          }
        />
      )}

      {activeSection === 'payments' && (
        <PaymentsPage
          initialFilter={activeFilter}
          onNavigateToInvoice={(invoiceId) =>
            navigateTo({
              kind: 'workspace',
              section: 'invoices',
              filter: `facture:${invoiceId}`,
            })
          }
          onNavigateToClient={(clientId) =>
            navigateTo({
              kind: 'workspace',
              section: 'clients',
              filter: `client:${clientId}`,
            })
          }
        />
      )}

      {activeSection === 'settings' && <SettingsPage currentUser={user} />}

      {activeSection === 'users' && user.role === 'ADMIN' && (
        <AdminUsersPage currentUser={user} />
      )}

      {activeSection === 'history' && <SecurityLogsPage currentUser={user} />}

      {activeSection !== 'supervision' &&
        activeSection !== 'dashboard' &&
        activeSection !== 'clients' &&
        activeSection !== 'invoices' &&
        activeSection !== 'imports' &&
        activeSection !== 'reminders' &&
        activeSection !== 'payments' &&
        activeSection !== 'settings' &&
        activeSection !== 'users' &&
        activeSection !== 'history' && (
          <ModulePlaceholderPage
            moduleConfig={currentModule}
            activeFilter={activeFilter}
            onReturnHome={() =>
              navigateTo({ kind: 'workspace', section: defaultSection })
            }
          />
        )}
    </AppShell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
