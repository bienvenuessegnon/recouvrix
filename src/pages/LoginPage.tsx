import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { RecouvrixLogo } from '../components/brand/RecouvrixLogo';
import { AlertBanner, Button, Input, LoadingState } from '../components/ui';
import { ApiError, authApi, setSessionToken } from '../services/api';
import type { AuthUser } from '../types/auth';

export interface LoginPageProps {
  sessionNotice?: string | null;
  onClearNotice: () => void;
  onBackToLanding: () => void;
  onLoginSuccess: (user: AuthUser, expiresAt: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  sessionNotice,
  onClearNotice,
  onBackToLanding,
  onLoginSuccess,
}) => {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [requiresInitialSetup, setRequiresInitialSetup] = useState(false);

  // États du formulaire de connexion
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // États du formulaire d'initialisation unique (uniquement si aucun admin n'est encore configuré)
  const [setupAdminPassword, setSetupAdminPassword] = useState('');
  const [setupManagerPassword, setSetupManagerPassword] = useState('');
  const [showSetupPasswords, setShowSetupPasswords] = useState(false);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadStatus = async () => {
      try {
        const status = await authApi.getStatus();
        if (mounted) {
          setRequiresInitialSetup(status.requiresInitialSetup);
        }
      } catch (err) {
        if (mounted) {
          setErrorMessage(
            err instanceof ApiError
              ? err.message
              : 'Problème temporaire de connexion au serveur.'
          );
        }
      } finally {
        if (mounted) {
          setCheckingStatus(false);
        }
      }
    };
    void loadStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearNotice();
    setErrorMessage(null);

    const nextFieldErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextFieldErrors.email = 'Veuillez saisir votre adresse e-mail.';
    }
    if (!password) {
      nextFieldErrors.password = 'Veuillez saisir votre mot de passe.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await authApi.login(email.trim(), password);
      setSessionToken(response.token);
      onLoginSuccess(response.user, response.expiresAt);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Problème temporaire de connexion. Veuillez réessayer.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    setSetupSuccess(null);

    if (!setupAdminPassword || !setupManagerPassword) {
      setSetupError('Veuillez définir un mot de passe pour les deux comptes.');
      return;
    }

    setSetupSubmitting(true);
    try {
      const res = await authApi.bootstrapDemo(setupAdminPassword, setupManagerPassword);
      setRequiresInitialSetup(false);
      setSetupSuccess(res.message);
      setEmail('admin@recouvrix.demo');
      setPassword('');
      setSetupAdminPassword('');
      setSetupManagerPassword('');
    } catch (err) {
      setSetupError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’initialiser les comptes pour le moment.'
      );
    } finally {
      setSetupSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-left rounded-md"
            aria-label="Retour à l’accueil Recouvrix"
          >
            <RecouvrixLogo variant="light" size="sm" />
          </button>

          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onBackToLanding}
          >
            Retour à l’accueil
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md space-y-5">
          {checkingStatus ? (
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-8">
              <LoadingState label="Vérification de la connexion au serveur…" />
            </div>
          ) : requiresInitialSetup ? (
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <RecouvrixLogo variant="light" size="md" />
                </div>
                <div className="space-y-1">
                  <h1 className="font-display text-[22px] font-bold text-[var(--color-ink)] leading-tight">
                    Configuration initiale de l’accès
                  </h1>
                  <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                    Aucun administrateur n’est encore initialisé. Définissez les mots de passe des comptes de présentation avant votre première connexion.
                  </p>
                </div>
              </div>

              {setupError && (
                <AlertBanner
                  tone="error"
                  title="Initialisation impossible"
                  description={setupError}
                />
              )}

              <form onSubmit={handleBootstrapSubmit} className="space-y-4" noValidate>
                <div className="space-y-1">
                  <p className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                    Compte Administrateur : admin@recouvrix.demo
                  </p>
                  <Input
                    label="Mot de passe Administrateur"
                    type={showSetupPasswords ? 'text' : 'password'}
                    required
                    value={setupAdminPassword}
                    onChange={(e) => setSetupAdminPassword(e.target.value)}
                    placeholder="Minimum 8 caractères (lettre + chiffre)"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                    Compte Gestionnaire : gestionnaire@recouvrix.demo
                  </p>
                  <Input
                    label="Mot de passe Gestionnaire"
                    type={showSetupPasswords ? 'text' : 'password'}
                    required
                    value={setupManagerPassword}
                    onChange={(e) => setSetupManagerPassword(e.target.value)}
                    placeholder="Minimum 8 caractères (lettre + chiffre)"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSetupPasswords((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]"
                  >
                    {showSetupPasswords ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Masquer les mots de passe</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Afficher les mots de passe</span>
                      </>
                    )}
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={setupSubmitting}
                >
                  Initialiser les comptes
                </Button>
              </form>
            </div>
          ) : (
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 sm:p-8 space-y-6">
              <div className="space-y-4">
                <RecouvrixLogo variant="light" size="md" />
                <div className="space-y-1">
                  <h1 className="font-display text-[22px] sm:text-[24px] font-bold text-[var(--color-ink)] leading-tight">
                    Connectez-vous à votre espace
                  </h1>
                  <p className="text-[14px] text-[var(--color-ink-muted)]">
                    Saisissez vos identifiants professionnels pour accéder à Recouvrix.
                  </p>
                </div>
              </div>

              {sessionNotice && (
                <AlertBanner
                  tone="warning"
                  title="Session interrompue"
                  description={sessionNotice}
                  onDismiss={onClearNotice}
                />
              )}

              {setupSuccess && (
                <AlertBanner
                  tone="success"
                  title="Accès initialisés"
                  description={setupSuccess}
                />
              )}

              {errorMessage && (
                <AlertBanner
                  tone="error"
                  title="Connexion impossible"
                  description={errorMessage}
                />
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <Input
                  label="Adresse e-mail"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  error={fieldErrors.email}
                  placeholder="nom@entreprise.com"
                  disabled={submitting}
                />

                <div className="space-y-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-[13px] font-medium text-[var(--color-ink)]"
                  >
                    Mot de passe
                    <span className="text-[var(--color-danger)] ml-1" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      disabled={submitting}
                      aria-invalid={Boolean(fieldErrors.password)}
                      placeholder="Votre mot de passe"
                      className={`w-full min-h-[40px] rounded-md bg-white pl-3 pr-10 py-2 text-[14px] text-[var(--color-ink)] placeholder:text-slate-400 border transition-colors duration-150 ${
                        fieldErrors.password
                          ? 'border-[var(--color-danger)]'
                          : 'border-[var(--color-border-strong)] hover:border-slate-400 focus:border-[var(--color-primary)]'
                      } disabled:bg-slate-100 disabled:text-slate-400`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      className="absolute inset-y-0 right-1 px-2.5 flex items-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] rounded"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-[12px] font-medium text-[var(--color-danger)]" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    icon={<LockKeyhole className="w-4 h-4" />}
                  >
                    {submitting ? 'Connexion en cours…' : 'Se connecter'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
