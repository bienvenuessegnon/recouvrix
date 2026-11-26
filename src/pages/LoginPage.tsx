import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { RecouvrixLogo } from '../components/brand/RecouvrixLogo';
import { AlertBanner, Button, Input, LoadingState } from '../components/ui';
import { ApiError, authApi, setSessionToken } from '../services/api';
import type { AuthUser } from '../types/auth';
import heroBackground from '../assets/images/recouvrix-hero-bg.jpg';

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
  const [authReady, setAuthReady] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    let mounted = true;
    const loadStatus = async () => {
      try {
        const status = await authApi.getStatus();
        if (mounted) {
          if (typeof status.authReady === 'boolean') {
            setAuthReady(status.authReady);
          } else {
            setAuthReady(Boolean(status.envDemoConfigured));
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

  return (
    <div className="relative min-h-screen flex flex-col text-[var(--color-ink)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#061018]">
        <img
          src={heroBackground}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-[70%_35%] opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(6,16,24,0.82)_0%,rgba(6,16,24,0.55)_45%,rgba(244,247,248,0.92)_72%,#F4F7F8_100%)]" />
      </div>

      <header className="border-b border-white/10 bg-[#061018]/40 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-left rounded-md"
            aria-label="Retour à l’accueil Recouvrix"
          >
            <RecouvrixLogo variant="dark" size="sm" />
          </button>

          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onBackToLanding}
            className="text-white hover:bg-white/10"
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
            <div className="bg-white border border-[var(--color-border)] rounded-lg p-6 sm:p-8 space-y-5">
              <RecouvrixLogo variant="light" size="md" />
              <div className="space-y-2">
                <h1 className="font-display text-[22px] font-bold text-[var(--color-ink)] leading-tight">
                  Accès non configuré
                </h1>
                <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                  Les mots de passe de démonstration doivent être définis côté serveur via les secrets
                  <span className="font-mono text-[13px]"> DEMO_ADMIN_PASSWORD </span>
                  et
                  <span className="font-mono text-[13px]"> DEMO_MANAGER_PASSWORD</span>.
                </p>
              </div>
              <AlertBanner
                tone="warning"
                title="Configuration requise"
                description="Sur Render ou Cursor, renseignez ces deux secrets puis redéployez. Aucune initialisation publique n’est autorisée."
              />
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

              {errorMessage && (
                <AlertBanner
                  tone="error"
                  title="Connexion impossible"
                  description={errorMessage}
                />
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <Input
                  id="login-email"
                  label="Adresse e-mail"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  error={fieldErrors.email}
                  placeholder="admin@recouvrix.demo"
                />

                <div className="space-y-1.5">
                  <Input
                    id="login-password"
                    label="Mot de passe"
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
                    error={fieldErrors.password}
                    placeholder="Votre mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Masquer le mot de passe</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Afficher le mot de passe</span>
                      </>
                    )}
                  </button>
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
