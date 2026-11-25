import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, UserPlus } from 'lucide-react';
import {
  AlertBanner,
  Button,
  ConfirmModal,
  DataTable,
  DataTableColumn,
  Input,
  Select,
  SideDrawer,
  StatusBadge,
  useToast,
} from '../components/ui';
import { formatDate, formatDateTime } from '../design-system/formatters';
import { ApiError, adminApi, authApi } from '../services/api';
import type { AuthUser, UserRole } from '../types/auth';

export interface AdminUsersPageProps {
  currentUser: AuthUser;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ currentUser }) => {
  const { notify } = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envDemoConfigured, setEnvDemoConfigured] = useState(false);

  // Tiroir de création d'utilisateur
  const [createOpen, setCreateOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('MANAGER');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Tiroir de modification d'utilisateur
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('MANAGER');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Modale de confirmation activation / désactivation
  const [statusTarget, setStatusTarget] = useState<AuthUser | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Modale de réinitialisation des comptes de présentation
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetAdminPass, setResetAdminPass] = useState('');
  const [resetManagerPass, setResetManagerPass] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, statusRes] = await Promise.all([
        adminApi.listUsers(),
        authApi.getStatus(),
      ]);
      setUsers(usersRes.users);
      setEnvDemoConfigured(statusRes.envDemoConfigured);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la liste des utilisateurs.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);

    try {
      const res = await adminApi.createUser({
        fullName: newFullName.trim(),
        email: newEmail.trim(),
        role: newRole,
        password: newPassword,
      });
      setUsers((prev) => [...prev, res.user]);
      setCreateOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewRole('MANAGER');
      setNewPassword('');
      notify({
        tone: 'success',
        title: 'Compte utilisateur créé',
        description: `${res.user.fullName} (${res.user.email}) a été ajouté.`,
      });
    } catch (err) {
      setCreateError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de créer le compte utilisateur.'
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEditDrawer = (user: AuthUser) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditRole(user.role);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setEditSubmitting(true);

    try {
      const res = await adminApi.updateUser(editingUser.id, {
        fullName: editFullName.trim(),
        role: editRole,
      });
      setUsers((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
      setEditingUser(null);
      notify({
        tone: 'success',
        title: 'Compte mis à jour',
        description: `Les informations de ${res.user.email} ont été enregistrées.`,
      });
    } catch (err) {
      setEditError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de modifier ce compte utilisateur.'
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setStatusSubmitting(true);
    try {
      const res = await adminApi.updateUser(statusTarget.id, {
        isActive: !statusTarget.isActive,
      });
      setUsers((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
      setStatusTarget(null);
      notify({
        tone: res.user.isActive ? 'success' : 'warning',
        title: res.user.isActive ? 'Compte réactivé' : 'Compte désactivé',
        description: res.user.isActive
          ? `${res.user.email} peut de nouveau se connecter.`
          : `${res.user.email} n’a plus accès à la plateforme.`,
      });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Opération refusée',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible de modifier le statut du compte.',
      });
      setStatusTarget(null);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleResetDemoConfirm = async () => {
    setResetError(null);
    setResetSubmitting(true);
    try {
      const res = await adminApi.resetDemoAccounts(
        envDemoConfigured
          ? undefined
          : {
              adminPassword: resetAdminPass,
              managerPassword: resetManagerPass,
            }
      );
      setUsers(res.users);
      setResetModalOpen(false);
      setResetAdminPass('');
      setResetManagerPass('');
      notify({
        tone: 'success',
        title: 'Comptes de présentation réinitialisés',
        description: res.message,
      });
    } catch (err) {
      setResetError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de réinitialiser les comptes de présentation.'
      );
    } finally {
      setResetSubmitting(false);
    }
  };

  const columns: Array<DataTableColumn<AuthUser>> = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-ink)]">{row.fullName}</p>
          <p className="text-[12px] text-[var(--color-ink-muted)]">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (row) => (
        <StatusBadge
          tone={row.role === 'ADMIN' ? 'info' : 'neutral'}
          label={row.role === 'ADMIN' ? 'Administrateur' : 'Gestionnaire'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <StatusBadge
          tone={row.isActive ? 'success' : 'danger'}
          label={row.isActive ? 'Actif' : 'Désactivé'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Date de création',
      render: (row) => (
        <span className="tabular-amount text-[13px] text-[var(--color-ink-secondary)]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Dernière connexion',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-amount text-[13px] text-[var(--color-ink-muted)]">
          {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Jamais connecté'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isSelf = row.id === currentUser.id;
        return (
          <div className="inline-flex items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => openEditDrawer(row)}>
              Modifier
            </Button>
            <Button
              size="sm"
              variant={row.isActive ? 'ghost' : 'secondary'}
              disabled={isSelf && row.isActive}
              onClick={() => setStatusTarget(row)}
            >
              {row.isActive ? 'Désactiver' : 'Réactiver'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[14px] text-[var(--color-ink-secondary)]">
          Seul un administrateur peut créer des comptes, modifier les rôles ou suspendre un accès.
        </p>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              setResetError(null);
              setResetModalOpen(true);
            }}
          >
            Réinitialiser les comptes de présentation
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            Créer un compte
          </Button>
        </div>
      </div>

      {error && (
        <AlertBanner
          tone="error"
          title="Erreur de chargement"
          description={error}
        />
      )}

      <DataTable
        columns={columns}
        data={users}
        rowKey={(row) => row.id}
        loading={loading}
        caption="Liste des comptes utilisateurs Recouvrix"
        emptyState={{
          title: 'Aucun utilisateur enregistré',
          description: 'Créez un premier compte Gestionnaire pour ouvrir un accès opérationnel.',
        }}
      />

      {/* Tiroir de création d'utilisateur */}
      <SideDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer un compte utilisateur"
        subtitle="Attribuez un rôle autorisé et un mot de passe initial sécurisé."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={createSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="create-user-form"
              variant="primary"
              loading={createSubmitting}
            >
              Créer le compte
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <AlertBanner
              tone="error"
              title="Création impossible"
              description={createError}
            />
          )}

          <Input
            label="Nom complet"
            required
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            placeholder="Ex. : Nadège Kpadonou"
          />

          <Input
            label="Adresse e-mail professionnelle"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nadege@entreprise.bj"
          />

          <Select
            label="Rôle attribué"
            required
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            options={[
              { value: 'MANAGER', label: 'Gestionnaire' },
              { value: 'ADMIN', label: 'Administrateur' },
            ]}
            helperText="Les autorisations correspondantes sont appliquées côté serveur."
          />

          <div className="space-y-1.5">
            <label
              htmlFor="new-user-password"
              className="block text-[13px] font-medium text-[var(--color-ink)]"
            >
              Mot de passe initial
              <span className="text-[var(--color-danger)] ml-1" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative">
              <input
                id="new-user-password"
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 caractères (lettre + chiffre)"
                className="w-full min-h-[40px] rounded-md bg-white pl-3 pr-10 py-2 text-[14px] text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:border-slate-400 focus:border-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={
                  showNewPassword
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
                className="absolute inset-y-0 right-1 px-2.5 flex items-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Le mot de passe est immédiatement haché sur le serveur et n’est jamais conservé en clair.
            </p>
          </div>
        </form>
      </SideDrawer>

      {/* Tiroir de modification d'utilisateur */}
      <SideDrawer
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Modifier le compte utilisateur"
        subtitle={editingUser?.email}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditingUser(null)}
              disabled={editSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="edit-user-form"
              variant="primary"
              loading={editSubmitting}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        {editingUser && (
          <form id="edit-user-form" onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <AlertBanner
                tone="error"
                title="Modification impossible"
                description={editError}
              />
            )}

            <Input
              label="Adresse e-mail"
              value={editingUser.email}
              disabled
              readOnly
            />

            <Input
              label="Nom complet"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />

            <Select
              label="Rôle"
              required
              value={editRole}
              disabled={editingUser.id === currentUser.id}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              options={[
                { value: 'MANAGER', label: 'Gestionnaire' },
                { value: 'ADMIN', label: 'Administrateur' },
              ]}
              helperText={
                editingUser.id === currentUser.id
                  ? 'Vous ne pouvez pas modifier votre propre rôle administrateur.'
                  : undefined
              }
            />
          </form>
        )}
      </SideDrawer>

      {/* Confirmation activation / désactivation */}
      <ConfirmModal
        open={Boolean(statusTarget)}
        tone={statusTarget?.isActive ? 'destructive' : 'primary'}
        title={
          statusTarget?.isActive
            ? `Désactiver le compte ${statusTarget.email} ?`
            : `Réactiver le compte ${statusTarget?.email ?? ''} ?`
        }
        description={
          statusTarget?.isActive
            ? 'Toutes les sessions actives de cet utilisateur seront immédiatement interrompues et toute nouvelle connexion sera refusée.'
            : 'L’utilisateur pourra de nouveau accéder à Recouvrix selon son rôle attribué.'
        }
        confirmLabel={statusTarget?.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
        loading={statusSubmitting}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
      />

      {/* Confirmation réinitialisation des comptes de présentation */}
      <ConfirmModal
        open={resetModalOpen}
        title="Réinitialiser les comptes de présentation ?"
        description="Les comptes admin@recouvrix.demo et gestionnaire@recouvrix.demo seront remis à leur rôle et état actif sans créer de doublon."
        confirmLabel="Réinitialiser les comptes"
        loading={resetSubmitting}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleResetDemoConfirm}
      >
        <div className="space-y-3 pt-1">
          {resetError && (
            <AlertBanner
              tone="error"
              title="Validation requise"
              description={resetError}
            />
          )}

          {envDemoConfigured ? (
            <AlertBanner
              tone="info"
              title="Configuration serveur détectée"
              description="Les mots de passe configurés dans l’environnement serveur seront appliqués."
            />
          ) : (
            <div className="space-y-3">
              <Input
                label="Nouveau mot de passe (admin@recouvrix.demo)"
                type="password"
                required
                value={resetAdminPass}
                onChange={(e) => setResetAdminPass(e.target.value)}
                placeholder="Minimum 8 caractères (lettre + chiffre)"
              />
              <Input
                label="Nouveau mot de passe (gestionnaire@recouvrix.demo)"
                type="password"
                required
                value={resetManagerPass}
                onChange={(e) => setResetManagerPass(e.target.value)}
                placeholder="Minimum 8 caractères (lettre + chiffre)"
              />
            </div>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
};
