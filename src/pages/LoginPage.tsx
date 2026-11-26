import React, { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, UserPlus } from 'lucide-react';
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

type AuthMode = 'login' | 'register';

export const LoginPage: React.FC<LoginPageProps> = ({
  sessionNotice,
  onClearNotice,
  onBackToLanding,
  onLoginSuccess,
}) => {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [authReady, setAuthReady] = useState(true);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [mode, setMode] = useState<AuthMode>('register');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    let mounted = true;
    const loadStatus = async () => {
      try {
        const status = await authApi.getStatus();
        if (mounted) {
          const canRegister = status.registrationOpen !== false;
          setRegistrationOpen(canRegister);
          setMode(canRegister ? 'register' : 'login');
          if (typeof status.authReady === 'boolean') {
            setAuthReady(status.authReady);
          } else {
            setAuthReady(Boolean(status.envDemoConfigured) || canRegister);
          }
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearNotice();
    setErrorMessage(null);

    const nextFieldErrors: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      nextFieldErrors.fullName = 'Indiquez votre nom complet.';
    }
    if (!email.trim()) {
      nextFieldErrors.email = 'Veuillez saisir votre adresse e-mail.';
    }
    if (!password || password.length < 8) {
      nextFieldErrors.password = 'Mot de passe : 8 caractères minimum, avec lettre et chiffre.';
    }
    if (password !== confirmPassword) {
      nextFieldErrors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await authApi.register(fullName.trim(), email.trim(), password);
      setSessionToken(response.token);
      onLoginSuccess(response.user, response.expiresAt);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Impossible de créer le compte. Veuillez réessayer.'
      );
    } finally {
      setSubmitting(false);
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
          ) : !authReady ? (
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <RecouvrixLogo variant="light" size="md" />
                <div className="space-y-1">
                  <h1 className="font-display text-[22px] font-bold text-[var(--color-ink)] leading-tight">
                    Accès non configuré
                  </h1>
                  <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                    Définissez DEMO_ADMIN_PASSWORD et DEMO_MANAGER_PASSWORD, ou activez la
                    création de compte publique.
                  </p>
                </div>
              </div>
              <AlertBanner
                tone="warning"
                title="Configuration requise"
                description="Renseignez les secrets sur le serveur d’hébergement, puis redémarrez le service."
              />
            </div>
          ) : (
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 sm:p-8 space-y-6">
              <div className="space-y-4">
                <RecouvrixLogo variant="light" size="md" />
                <div className="space-y-1">
                  <h1 className="font-display text-[22px] sm:text-[24px] font-bold text-[var(--color-ink)] leading-tight">
                    {mode === 'login' ? 'Connexion' : 'Créer un compte'}
                  </h1>
                  <p className="text-[14px] text-[var(--color-ink-muted)]">
                    {mode === 'login'
                      ? 'Connectez-vous avec votre e-mail et votre mot de passe.'
                      : 'Créez votre accès démo en quelques secondes, puis importez vos créances.'}
                  </p>
                </div>
              </div>

              {registrationOpen && (
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMessage(null);
                      setFieldErrors({});
                    }}
                    className={`min-h-[40px] rounded-md text-[13px] font-semibold transition-colors ${
                      mode === 'login'
                        ? 'bg-white text-[var(--color-ink)] shadow-sm'
                        : 'text-[var(--color-ink-muted)]'
                    }`}
                  >
                    Se connecter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMessage(null);
                      setFieldErrors({});
                    }}
                    className={`min-h-[40px] rounded-md text-[13px] font-semibold transition-colors ${
                      mode === 'register'
                        ? 'bg-white text-[var(--color-ink)] shadow-sm'
                        : 'text-[var(--color-ink-muted)]'
                    }`}
                  >
                    Créer un compte
                  </button>
                </div>
              )}

              {sessionNotice && (
                <AlertBanner
                  tone="warning"
                  title="Session interrompue"
                  description={sessionNotice}
                  onDismiss={onClearNotice}
                />
              )}

              {errorMessage && (
                <AlertBanner
                  tone="error"
                  title={mode === 'login' ? 'Connexion impossible' : 'Inscription impossible'}
                  description={errorMessage}
                />
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                  <Input
                    id="login-email"
                    label="Adresse e-mail"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.email)}
                    error={fieldErrors.email}
                    placeholder="ex. vous@entreprise.bj"
                  />

                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-[13px] font-medium text-[var(--color-ink)]"
                    >
                      Mot de passe
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
                        aria-invalid={Boolean(fieldErrors.password)}
                        className={`w-full min-h-[40px] rounded-md border bg-white px-3 py-2 pr-10 text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ${
                          fieldErrors.password
                            ? 'border-[var(--color-danger)]'
                            : 'border-[var(--color-border-strong)]'
                        }`}
                        placeholder="Votre mot de passe"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] text-[12px] font-medium"
                      >
                        {showPassword ? 'Masquer' : 'Voir'}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-[12px] font-medium text-[var(--color-danger)]" role="alert">
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    icon={<LockKeyhole className="w-4 h-4" />}
                  >
                    Se connecter
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
                  <Input
                    id="register-fullname"
                    label="Nom complet"
                    type="text"
                    autoComplete="name"
                    autoFocus
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                    error={fieldErrors.fullName}
                    placeholder="ex. Amina Bello"
                  />
                  <Input
                    id="register-email"
                    label="Adresse e-mail"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    error={fieldErrors.email}
                    placeholder="ex. vous@entreprise.bj"
                  />
                  <Input
                    id="register-password"
                    label="Mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    error={fieldErrors.password}
                    placeholder="8+ caractères, lettre et chiffre"
                  />
                  <Input
                    id="register-confirm"
                    label="Confirmer le mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    error={fieldErrors.confirmPassword}
                    placeholder="Retapez le mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-[12px] font-medium text-[var(--color-primary)]"
                  >
                    {showPassword ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    icon={<UserPlus className="w-4 h-4" />}
                  >
                    Créer mon compte
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
