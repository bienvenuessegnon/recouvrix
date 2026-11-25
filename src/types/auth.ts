export type UserRole = 'ADMIN' | 'MANAGER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface ActivityLogEntry {
  id: string;
  eventType: string;
  actorUserId: string | null;
  actorLabel: string;
  targetUserId: string | null;
  targetLabel: string | null;
  summary: string;
  createdAt: string;
}

export interface AuthStatusResponse {
  requiresInitialSetup: boolean;
  envDemoConfigured: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface WorkspaceOverviewResponse {
  workspace: 'ADMIN_SUPERVISION' | 'MANAGER_OPERATIONS';
  summary: {
    totalUsers?: number;
    activeUsers?: number;
    managerCount?: number;
    recentEventCount?: number;
    roleLabel?: string;
    authorizedModules?: string[];
  };
}
