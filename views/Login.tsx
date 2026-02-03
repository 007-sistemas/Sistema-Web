
import React, { useEffect, useState } from 'react';
import { HospitalPermissions } from '../types';
import { StorageService } from '../services/storage';
import { apiPost } from '../services/api';
import { Lock, User, AlertCircle, ArrowRight, Mail, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (permissions: HospitalPermissions) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'set'>('request');
  const [identifier, setIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [resetInfo, setResetInfo] = useState('');
  const [resetError, setResetError] = useState('');
  const [cooldown, setCooldown] = useState<number>(0);
  const [provider, setProvider] = useState<string>('');
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeMessage, setCodeMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Atualiza dados remotos antes de autenticar
      await StorageService.refreshManagersFromRemote();
      await StorageService.refreshCooperadosFromRemote();
      await StorageService.refreshHospitaisFromRemote();
      await StorageService.refreshPontosFromRemote();

      const authResult = StorageService.authenticate(username, password);

      if (authResult) {
        const sessionData = {
          user: authResult.user,
          type: authResult.type,
          permissions: authResult.permissions,
          timestamp: new Date().toISOString()
        };
        StorageService.setSession(sessionData);
        onLoginSuccess(authResult.permissions);
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Falha ao autenticar. Tente novamente.');
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetInfo('');
    setProvider('');
    try {
      const resp: any = await apiPost('reset-request', { identifier });
      const prov = resp?.provider ? String(resp.provider) : '';
      setProvider(prov);
      if (resp?.emailSent) {
        StorageService.logAudit('RESET_EMAIL_ENVIADO', `Código enviado para ${identifier} via ${prov || 'email'}`);
      }
      setResetInfo('Código enviado para o email cadastrado (se existir).');
      if (resp?.devCode) {
        setResetInfo(`Código enviado. (Dev: ${resp.devCode})`);
      }
      setCooldown(120);
      setResetStep('verify');
    } catch (err: any) {
      // Tentar extrair JSON com retryAfter
      let msg = err?.message || 'Falha ao solicitar redefinição.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.retryAfter) {
          const secs = Number(parsed.retryAfter) || 120;
          setCooldown(secs);
          setResetError(`Aguarde ${secs}s para reenviar.`);
        } else if (parsed?.error) {
          setResetError(parsed.error);
        } else {
          setResetError(msg);
        }
      } catch {
        setResetError(msg);
      }
    }
  };

  const handleCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetInfo('');
    setCodeMessage(null);
    if (!identifier || !resetCode) {
      setCodeMessage({ type: 'error', text: 'Preencha usuário/email e código.' });
      return;
    }
    setCodeVerifying(true);
    try {
      await apiPost('reset-verify', { identifier, code: resetCode });
      setCodeMessage({ type: 'success', text: '✓ Código válido' });
      setResetInfo('Código validado. Agora, defina a nova senha.');
      StorageService.logAudit('RESET_CODIGO_VALIDADO', `Código válido para ${identifier}`);
      setTimeout(() => setResetStep('set'), 500);
    } catch (err: any) {
      let msg = err?.message || 'Código inválido ou expirado.';
      try {
        const parsed = JSON.parse(msg);
        msg = parsed?.error || msg;
      } catch {}
      setCodeMessage({ type: 'error', text: msg });
    } finally {
      setCodeVerifying(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetInfo('');
    if (!identifier || !resetCode || !newPass) {
      setResetError('Preencha usuário/email, código e nova senha.');
      return;
    }
    if (newPass !== confirmPass) {
      setResetError('As senhas não conferem.');
      return;
    }
    // Validação de força mínima no client (reforço à validação do servidor)
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPass);
    if (!strong) {
      setResetError('Senha fraca. Use no mínimo 8 caracteres, com letras maiúsculas, minúsculas e números.');
      return;
    }
    try {
      await apiPost('reset-confirm', { identifier, code: resetCode, newPassword: newPass });
      StorageService.logAudit('RESET_CONFIRMADO', `Senha redefinida para ${identifier}`);
      setResetInfo('Senha redefinida com sucesso. Use a nova senha para entrar.');
      setPassword(newPass);
      setShowReset(false);
    } catch (err: any) {
      let msg = err?.message || 'Código inválido ou expirado.';
      try {
        const parsed = JSON.parse(msg);
        setResetError(parsed?.error || msg);
      } catch {
        setResetError(msg);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="text-center mb-0">
          <img src="/templates/iDev Logo Preto.png" alt="Idev" className="h-44 w-auto mx-auto" />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm mb-3 animate-fade-in">
            <AlertCircle className="h-4 w-4 mr-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 ml-1">Usuário</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowReset(!showReset)}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
              loading ? 'bg-primary-400 cursor-wait' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Autenticando...
              </span>
            ) : (
              <span className="flex items-center">
                Acessar <ArrowRight className="ml-2 h-5 w-5" />
              </span>
            )}
          </button>
        </form>

        {showReset && (
          <div className="mt-6 border-t border-gray-200 pt-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-700">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              <span className="font-semibold">Redefinir senha</span>
            </div>

            {resetError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                {resetError}
              </div>
            )}
            {resetInfo && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
                {resetInfo}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 ml-1">Usuário ou Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900"
                    placeholder="Digite seu usuário ou email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>

              {resetStep === 'verify' && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Código</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900"
                      placeholder="Código de 6 dígitos"
                      value={resetCode}
                      onChange={(e) => {
                        setResetCode(e.target.value);
                        setCodeMessage(null);
                      }}
                    />
                    {codeMessage && (
                      <div className={`text-xs mt-1 flex items-center gap-1 ${codeMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                        {codeMessage.type === 'error' && <AlertCircle className="h-3 w-3" />}
                        {codeMessage.text}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCodeVerify}
                      disabled={codeVerifying}
                      className={`flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors ${codeVerifying ? 'opacity-70 cursor-wait' : ''}`}
                    >
                      {codeVerifying ? 'Validando...' : 'Validar código'}
                    </button>
                  </div>
                </>
              )}

              {resetStep === 'set' && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Nova senha</label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900"
                      placeholder="Mínimo 8 caracteres, com maiúscula, minúscula e número"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Confirmar nova senha</label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900"
                      placeholder="Repita a nova senha"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Ações */}

              <div className="flex gap-2">
                <button
                  onClick={handleResetRequest}
                  disabled={cooldown > 0}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${cooldown > 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                >
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Enviar código'}
                </button>
                <button
                  onClick={handleResetConfirm}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors"
                >
                  Confirmar
                </button>
              </div>
              {provider && (
                <div className="text-xs text-gray-500 mt-2">Envio: {provider.toUpperCase()}</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          Idev &bull; Controle de Produção
        </div>
      </div>
    </div>
  );
};
