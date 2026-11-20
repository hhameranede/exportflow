export const AUTH_ROUTES = [
  ["/signin", "Sign in", "Sign in to your ExportFlow workspace or continue with Google.", "auth-signin"],
  ["/signup", "Create account", "Create an ExportFlow developer account with email or Google.", "auth-signup"],
  ["/forgot-password", "Reset password", "Request a password reset link for your ExportFlow account.", "auth-forgot"],
  ["/account", "Account & Google Linking", "Manage your profile, connected Google identity, sessions, and security settings.", "auth-account"],
];

const AUTH_LOCALES = {
  en: {
    eyebrowSignin: "ACCOUNT ACCESS · UI BLUEPRINT",
    eyebrowSignup: "DEVELOPER ONBOARDING · UI BLUEPRINT",
    eyebrowForgot: "ACCOUNT RECOVERY · UI BLUEPRINT",
    eyebrowAccount: "WORKSPACE IDENTITY · UI BLUEPRINT",
    blueprintBadge: "Frontend UI Ready · Connect Your Backend",
    signinTitle: "Sign in to ExportFlow",
    signinLead: "Access your developer workspace, API keys, and execution logs. This interface is pre-wired for email/password and Google OAuth 2.0.",
    signupTitle: "Create your account",
    signupLead: "Set up a workspace identity using your email address or link an existing Google account in one step.",
    forgotTitle: "Reset your password",
    forgotLead: "Enter the email associated with your account and we will prepare a recovery request payload.",
    accountTitle: "Account & Connected Identities",
    accountLead: "Inspect and test profile settings, Google account linking, active sessions, and 2FA controls before wiring your production API.",
    googleContinue: "Continue with Google",
    googleSignup: "Sign up with Google",
    googleConnect: "Connect Google account",
    googleDisconnect: "Disconnect Google",
    orDivider: "or continue with email",
    emailLabel: "Work email",
    emailPlaceholder: "developer@company.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    newPasswordLabel: "Create password",
    newPasswordPlaceholder: "At least 8 characters",
    nameLabel: "Full name",
    namePlaceholder: "Samer Al-Mansoor",
    orgLabel: "Workspace / Organization (optional)",
    orgPlaceholder: "Acme Agents Lab",
    rememberMe: "Keep session active on this browser",
    forgotLink: "Forgot password?",
    signinSubmit: "Sign in",
    signupSubmit: "Create account",
    forgotSubmit: "Send reset link",
    backToSignin: "Back to sign in",
    noAccount: "New to ExportFlow?",
    createOne: "Create an account",
    hasAccount: "Already have an account?",
    signInLink: "Sign in",
    acceptTerms: "I agree to the Terms of Service and Privacy Policy.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    accountNavLabel: "Account",
    profileTitle: "Profile & Workspace",
    saveProfile: "Save changes",
    providersTitle: "Connected Identity Providers",
    providersDesc: "Link Google OAuth 2.0 for single sign-on or manage fallback email credentials.",
    googleProviderName: "Google Account",
    linkedBadge: "Linked",
    unlinkedBadge: "Not linked",
    emailProviderName: "Email & Password",
    configuredBadge: "Configured",
    sessionsTitle: "Active Sessions",
    sessionsDesc: "Review browsers and runtimes authorized to act on behalf of this account.",
    revokeBtn: "Revoke",
    securityTitle: "Two-Factor Authentication (2FA)",
    securityDesc: "Require a time-based authenticator code (TOTP) when signing in with email.",
    enable2fa: "Enable 2FA Preview",
    disable2fa: "Disable 2FA Preview",
    signOutBtn: "Sign out",
    contractTitle: "Backend Integration Contract",
    contractDesc: "Frontend hooks and expected JSON endpoints ready for your real auth server.",
    copyContract: "Copy contract",
    previewOpenAccount: "Open Account Dashboard Preview",
    modalTitle: "Link Google Account (OAuth 2.0 Preview)",
    modalSub: "Simulated Google consent dialog. Connect your real Google Client ID & callback URL on the backend.",
    modalCustomLabel: "Or test with any Gmail address",
    modalScopesTitle: "Requested OAuth Scopes",
    modalAllow: "Allow & link Google",
    modalCancel: "Cancel",
  },
  ar: {
    eyebrowSignin: "دخول الحسابات · واجهة جاهزة للربط",
    eyebrowSignup: "إنشاء حساب مطور · واجهة جاهزة للربط",
    eyebrowForgot: "استعادة كلمة المرور · واجهة جاهزة للربط",
    eyebrowAccount: "إدارة الهوية والربط · معاينة تفاعلية",
    blueprintBadge: "واجهة أمامية متكاملة · جاهزة للربط بالـ Backend",
    signinTitle: "تسجيل الدخول إلى ExportFlow",
    signinLead: "ادخل إلى مساحة العمل ومفاتيح الـ API وسجلات التنفيذ. الواجهة مجهزة بالكامل للدخول بالبريد الإلكتروني أو عبر حساب Google.",
    signupTitle: "إنشاء حساب جديد",
    signupLead: "أنشئ هوية مطور جديدة باستخدام بريدك الإلكتروني أو اربط حساب Google مباشرة في خطوة واحدة.",
    forgotTitle: "إعادة تعيين كلمة المرور",
    forgotLead: "أدخل البريد الإلكتروني المرتبط بحسابك لتجهيز طلب استعادة كلمة المرور.",
    accountTitle: "الحساب والربط مع Google",
    accountLead: "استعرض وجرّب إعدادات الملف الشخصي، ربط وفصل حساب Google، الجلسات النشطة، والمصادقة الثنائية قبل ربط الخادم الحقيقي.",
    googleContinue: "المتابعة باستخدام Google",
    googleSignup: "التسجيل باستخدام Google",
    googleConnect: "ربط حساب Google",
    googleDisconnect: "فصل حساب Google",
    orDivider: "أو المتابعة بالبريد الإلكتروني",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "name@company.com",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    newPasswordLabel: "إنشاء كلمة مرور",
    newPasswordPlaceholder: "8 أحرف على الأقل",
    nameLabel: "الاسم الكامل",
    namePlaceholder: "سامر المنصور",
    orgLabel: "اسم الفريق أو مساحة العمل (اختياري)",
    orgPlaceholder: "مختبر الوكلاء الذكي",
    rememberMe: "إبقاء الجلسة نشطة على هذا المتصفح",
    forgotLink: "نسيت كلمة المرور؟",
    signinSubmit: "تسجيل الدخول",
    signupSubmit: "إنشاء الحساب",
    forgotSubmit: "إرسال رابط الاستعادة",
    backToSignin: "العودة لتسجيل الدخول",
    noAccount: "ليس لديك حساب بعد؟",
    createOne: "أنشئ حسابًا جديدًا",
    hasAccount: "لديك حساب بالفعل؟",
    signInLink: "تسجيل الدخول",
    acceptTerms: "أوافق على شروط الخدمة وسياسة الخصوصية.",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    accountNavLabel: "الحساب",
    profileTitle: "الملف الشخصي ومساحة العمل",
    saveProfile: "حفظ التعديلات",
    providersTitle: "موفرو الهوية المرتبطون",
    providersDesc: "اربط حساب Google OAuth 2.0 لتسجيل الدخول الموحّد أو تحكّم في بيانات البريد وكلمة المرور.",
    googleProviderName: "حساب Google",
    linkedBadge: "مرتبط",
    unlinkedBadge: "غير مرتبط",
    emailProviderName: "البريد الإلكتروني وكلمة المرور",
    configuredBadge: "مفعّل",
    sessionsTitle: "الجلسات النشطة",
    sessionsDesc: "راجع المتصفحات وبيئات التشغيل المصرح لها باستخدام هذا الحساب.",
    revokeBtn: "إنهاء الجلسة",
    securityTitle: "المصادقة الثنائية (2FA)",
    securityDesc: "اطلب رمز تحقق مؤقت (TOTP) عند تسجيل الدخول عبر البريد الإلكتروني.",
    enable2fa: "تفعيل معاينة 2FA",
    disable2fa: "إلغاء معاينة 2FA",
    signOutBtn: "تسجيل الخروج",
    contractTitle: "عقد الربط مع الخادم (Backend Contract)",
    contractDesc: "نقاط النهاية المتوقعة ودوال الواجهة الأمامية جاهزة لاستبدالها بطلبات الخادم الحقيقي.",
    copyContract: "نسخ العقد",
    previewOpenAccount: "معاينة لوحة الحساب والربط",
    modalTitle: "ربط حساب Google (معاينة OAuth 2.0)",
    modalSub: "محاكاة لنافذة موافقة Google. عند الربط الحقيقي يتم توجيه المستخدم لـ Client ID الخاص بك.",
    modalCustomLabel: "أو اختبر بأي بريد Gmail",
    modalScopesTitle: "الصلاحيات المطلوبة (OAuth Scopes)",
    modalAllow: "السماح وربط الحساب",
    modalCancel: "إلغاء",
  },
  fr: {
    signinTitle: "Connexion à ExportFlow",
    signupTitle: "Créer un compte",
    forgotTitle: "Réinitialiser le mot de passe",
    accountTitle: "Compte et liaison Google",
    googleContinue: "Continuer avec Google",
    googleSignup: "S’inscrire avec Google",
    googleConnect: "Lier un compte Google",
    googleDisconnect: "Dissocier Google",
    orDivider: "ou continuer par e-mail",
    signinSubmit: "Connexion",
    signupSubmit: "Créer un compte",
    accountNavLabel: "Compte",
  },
  es: {
    signinTitle: "Iniciar sesión en ExportFlow",
    signupTitle: "Crear cuenta",
    forgotTitle: "Restablecer contraseña",
    accountTitle: "Cuenta y vinculación con Google",
    googleContinue: "Continuar con Google",
    googleSignup: "Registrarse con Google",
    googleConnect: "Conectar cuenta de Google",
    googleDisconnect: "Desconectar Google",
    orDivider: "o continuar con correo",
    signinSubmit: "Iniciar sesión",
    signupSubmit: "Crear cuenta",
    accountNavLabel: "Cuenta",
  },
  de: {
    signinTitle: "Bei ExportFlow anmelden",
    signupTitle: "Konto erstellen",
    forgotTitle: "Passwort zurücksetzen",
    accountTitle: "Konto & Google-Verknüpfung",
    googleContinue: "Mit Google fortfahren",
    googleSignup: "Mit Google registrieren",
    googleConnect: "Google-Konto verknüpfen",
    googleDisconnect: "Google trennen",
    orDivider: "oder mit E-Mail fortfahren",
    signinSubmit: "Anmelden",
    signupSubmit: "Konto erstellen",
    accountNavLabel: "Konto",
  },
  pt: {
    signinTitle: "Entrar no ExportFlow",
    signupTitle: "Criar conta",
    forgotTitle: "Redefinir senha",
    accountTitle: "Conta e vinculação Google",
    googleContinue: "Continuar com o Google",
    googleSignup: "Cadastrar com o Google",
    googleConnect: "Conectar conta Google",
    googleDisconnect: "Desconectar Google",
    orDivider: "ou continuar com e-mail",
    signinSubmit: "Entrar",
    signupSubmit: "Criar conta",
    accountNavLabel: "Conta",
  },
  zh: {
    signinTitle: "登录 ExportFlow",
    signupTitle: "创建账户",
    forgotTitle: "重置密码",
    accountTitle: "账户与 Google 关联",
    googleContinue: "使用 Google 继续",
    googleSignup: "使用 Google 注册",
    googleConnect: "关联 Google 账户",
    googleDisconnect: "取消关联 Google",
    orDivider: "或使用邮箱继续",
    signinSubmit: "登录",
    signupSubmit: "创建账户",
    accountNavLabel: "账户",
  },
  ja: {
    signinTitle: "ExportFlow にサインイン",
    signupTitle: "アカウント作成",
    forgotTitle: "パスワードをリセット",
    accountTitle: "アカウントと Google 連携",
    googleContinue: "Google で続行",
    googleSignup: "Google で登録",
    googleConnect: "Google アカウントを連携",
    googleDisconnect: "Google 連携を解除",
    orDivider: "またはメールアドレスで続行",
    signinSubmit: "サインイン",
    signupSubmit: "アカウントを作成",
    accountNavLabel: "アカウント",
  },
};

export function getAuthCopy(locale = "en") {
  return { ...AUTH_LOCALES.en, ...(AUTH_LOCALES[locale] || {}) };
}

function googleMarkSvg() {
  return `<svg class="ef-google-g" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z"/>
    <path fill="#FBBC05" d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76l4.01-3.11z"/>
    <path fill="#EA4335" d="M12 4.78c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.62l4.01 3.11c.95-2.84 3.6-4.95 6.72-4.95z"/>
  </svg>`;
}

function eyeIconSvg() {
  return `<svg class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;
}

function shieldIconSvg() {
  return `<svg class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>`;
}

function backendContractCard(at, escapeHtml) {
  const contractSample = JSON.stringify({
    auth: {
      login: "POST /api/auth/login",
      signup: "POST /api/auth/signup",
      logout: "POST /api/auth/logout",
      forgotPassword: "POST /api/auth/forgot-password",
    },
    googleOAuth: {
      start: "GET /api/auth/google/start?mode=signin|link",
      callback: "GET /api/auth/google/callback",
      link: "POST /api/account/providers/google/link",
      unlink: "DELETE /api/account/providers/google",
      scopes: ["openid", "email", "profile"],
    },
    account: {
      me: "GET /api/account/me",
      updateProfile: "PATCH /api/account/profile",
      sessions: "GET|DELETE /api/account/sessions/:id",
    },
  }, null, 2);

  return `<div class="ef-contract-box">
    <div class="ef-contract-head">
      <div>
        <span class="ef-badge ef-badge-dev">
          <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
          <span>${escapeHtml(at.blueprintBadge)}</span>
        </span>
        <h2>${escapeHtml(at.contractTitle)}</h2>
        <p>${escapeHtml(at.contractDesc)}</p>
      </div>
      <button type="button" class="ef-code-btn" data-copy-contract="${escapeHtml(contractSample)}">
        <span>${escapeHtml(at.copyContract)}</span>
      </button>
    </div>
    <pre class="ef-contract-pre"><code>${escapeHtml(contractSample)}</code></pre>
    <p class="ef-contract-note">Client adapter hook: <code>window.ExportFlowAuth</code> in <code>/assets/marketing.js</code></p>
  </div>`;
}

function googleConsentModalHtml(at, escapeHtml) {
  return `<div class="ef-modal-backdrop" data-google-modal-backdrop hidden>
    <div class="ef-modal" data-google-modal role="dialog" aria-modal="true" aria-labelledby="ef-gmodal-title">
      <div class="ef-modal-head">
        <div class="ef-modal-brand-bridge" aria-hidden="true">
          <span class="ef-mark">
            <svg class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h6M14 6h6M14 18h6M10 12l4-6m-4 6 4 6"/><circle cx="4" cy="12" r="1.8" fill="currentColor"/><circle cx="20" cy="6" r="1.8"/><circle cx="20" cy="18" r="1.8"/></svg>
          </span>
          <span class="ef-bridge-dots">•••</span>
          <span class="ef-google-badge-circle">${googleMarkSvg()}</span>
        </div>
        <button type="button" class="ef-icon-btn" data-google-modal-close aria-label="${escapeHtml(at.modalCancel)}">
          <svg class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <h2 id="ef-gmodal-title" class="ef-modal-title">${escapeHtml(at.modalTitle)}</h2>
      <p class="ef-modal-sub">${escapeHtml(at.modalSub)}</p>

      <div class="ef-google-picker" role="radiogroup" aria-label="Choose a preview Google account">
        <button type="button" class="ef-google-pick-row is-selected" data-google-preset="samer.dev@gmail.com" data-google-name="Samer Dev" aria-checked="true" role="radio">
          <span class="ef-avatar-circle">SD</span>
          <span class="ef-pick-meta">
            <strong>Samer Dev</strong>
            <span>samer.dev@gmail.com</span>
          </span>
          <span class="ef-badge ef-badge-available"><span>Google</span></span>
        </button>
        <button type="button" class="ef-google-pick-row" data-google-preset="team.ops@gmail.com" data-google-name="ExportFlow Ops" aria-checked="false" role="radio">
          <span class="ef-avatar-circle">EO</span>
          <span class="ef-pick-meta">
            <strong>ExportFlow Ops</strong>
            <span>team.ops@gmail.com</span>
          </span>
          <span class="ef-badge ef-badge-planned"><span>Workspace</span></span>
        </button>
      </div>

      <div class="ef-field ef-mt-12">
        <label for="ef-gmodal-email">${escapeHtml(at.modalCustomLabel)}</label>
        <input id="ef-gmodal-email" type="email" value="samer.dev@gmail.com" placeholder="you@gmail.com" data-google-email-input>
      </div>

      <div class="ef-scope-box">
        <span class="ef-scope-title">${escapeHtml(at.modalScopesTitle)}</span>
        <ul class="ef-provider-scopes">
          <li>openid · Verify Google identity</li>
          <li>email · Read primary email</li>
          <li>profile · Display name &amp; avatar</li>
        </ul>
      </div>

      <div class="ef-modal-actions">
        <button type="button" class="ef-btn ef-btn-secondary" data-google-modal-close>${escapeHtml(at.modalCancel)}</button>
        <button type="button" class="ef-btn ef-btn-primary" data-google-confirm>
          ${googleMarkSvg()}
          <span>${escapeHtml(at.modalAllow)}</span>
        </button>
      </div>
    </div>
  </div>`;
}

export function renderAuthPage(type, t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon) {
  const at = getAuthCopy(locale);

  if (type === "auth-signin") {
    return `<section class="ef-auth-section">
      <div class="ef-container ef-auth-grid">
        <div class="ef-auth-intro">
          <p class="ef-eyebrow">${escapeHtml(at.eyebrowSignin)}</p>
          <h1 class="ef-auth-title">${escapeHtml(at.signinTitle)}</h1>
          <p class="ef-auth-lead">${escapeHtml(at.signinLead)}</p>

          <ul class="ef-auth-highlights">
            <li>${shieldIconSvg()}<span>OAuth 2.0 PKCE + state/nonce ready for Google Sign-In</span></li>
            <li>${shieldIconSvg()}<span>Strict CSP-safe forms with accessible inline validation</span></li>
            <li>${shieldIconSvg()}<span>Instant preview mode — switch to your real API via one adapter</span></li>
          </ul>

          <div class="ef-auth-preview-link-wrap">
            <a class="ef-btn ef-btn-secondary ef-btn-sm" href="${hrefFor("/account", locale)}">
              <span>${escapeHtml(at.previewOpenAccount)}</span>
              ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
            </a>
          </div>

          ${backendContractCard(at, escapeHtml)}
        </div>

        <div class="ef-auth-card">
          <div class="ef-auth-card-head">
            <span class="ef-badge ef-badge-dev">
              <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
              <span>UI Blueprint</span>
            </span>
            <h2>${escapeHtml(at.signinSubmit)}</h2>
          </div>

          <button type="button" class="ef-google-btn" data-google-oauth-btn data-google-mode="signin" data-redirect-account="${hrefFor("/account", locale)}">
            ${googleMarkSvg()}
            <span>${escapeHtml(at.googleContinue)}</span>
          </button>

          <div class="ef-auth-divider"><span>${escapeHtml(at.orDivider)}</span></div>

          <form class="ef-auth-form" data-auth-form="signin" data-redirect-account="${hrefFor("/account", locale)}" novalidate>
            <div class="ef-field">
              <label for="auth-email">${escapeHtml(at.emailLabel)}</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="${escapeHtml(at.emailPlaceholder)}" required aria-describedby="auth-email-err">
              <span id="auth-email-err" class="ef-field-error" data-error-for="email" role="alert"></span>
            </div>

            <div class="ef-field">
              <label for="auth-password">${escapeHtml(at.passwordLabel)}</label>
              <div class="ef-password-wrap">
                <input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="${escapeHtml(at.passwordPlaceholder)}" required minlength="8" aria-describedby="auth-password-err">
                <button type="button" class="ef-password-toggle" data-toggle-password="auth-password" aria-pressed="false" aria-label="${escapeHtml(at.showPassword)}">
                  ${eyeIconSvg()}
                </button>
              </div>
              <span id="auth-password-err" class="ef-field-error" data-error-for="password" role="alert"></span>
            </div>

            <div class="ef-auth-meta-row">
              <label class="ef-consent">
                <input type="checkbox" name="remember" checked>
                <span>${escapeHtml(at.rememberMe)}</span>
              </label>
              <a class="ef-auth-inline-link" href="${hrefFor("/forgot-password", locale)}">${escapeHtml(at.forgotLink)}</a>
            </div>

            <button class="ef-btn ef-btn-primary ef-btn-full" type="submit">
              <span>${escapeHtml(at.signinSubmit)}</span>
              ${arrowRightIcon()}
            </button>

            <p class="ef-form-banner" role="status" data-form-status>UI blueprint ready — submits locally until wired to your backend.</p>
          </form>

          <p class="ef-auth-switch">
            <span>${escapeHtml(at.noAccount)}</span>
            <a href="${hrefFor("/signup", locale)}">${escapeHtml(at.createOne)}</a>
          </p>
        </div>
      </div>
      ${googleConsentModalHtml(at, escapeHtml)}
    </section>`;
  }

  if (type === "auth-signup") {
    return `<section class="ef-auth-section">
      <div class="ef-container ef-auth-grid">
        <div class="ef-auth-intro">
          <p class="ef-eyebrow">${escapeHtml(at.eyebrowSignup)}</p>
          <h1 class="ef-auth-title">${escapeHtml(at.signupTitle)}</h1>
          <p class="ef-auth-lead">${escapeHtml(at.signupLead)}</p>

          <ul class="ef-auth-highlights">
            <li>${shieldIconSvg()}<span>Password policy strength meter &amp; confirmation rules built in</span></li>
            <li>${shieldIconSvg()}<span>Seamless Google identity signup + post-signup account linking</span></li>
            <li>${shieldIconSvg()}<span>Workspace name capture ready for multi-tenant provisioning</span></li>
          </ul>

          ${backendContractCard(at, escapeHtml)}
        </div>

        <div class="ef-auth-card">
          <div class="ef-auth-card-head">
            <span class="ef-badge ef-badge-dev">
              <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
              <span>UI Blueprint</span>
            </span>
            <h2>${escapeHtml(at.signupSubmit)}</h2>
          </div>

          <button type="button" class="ef-google-btn" data-google-oauth-btn data-google-mode="signup" data-redirect-account="${hrefFor("/account", locale)}">
            ${googleMarkSvg()}
            <span>${escapeHtml(at.googleSignup)}</span>
          </button>

          <div class="ef-auth-divider"><span>${escapeHtml(at.orDivider)}</span></div>

          <form class="ef-auth-form" data-auth-form="signup" data-redirect-account="${hrefFor("/account", locale)}" novalidate>
            <div class="ef-field">
              <label for="su-name">${escapeHtml(at.nameLabel)}</label>
              <input id="su-name" name="name" type="text" autocomplete="name" placeholder="${escapeHtml(at.namePlaceholder)}" required maxlength="100" aria-describedby="su-name-err">
              <span id="su-name-err" class="ef-field-error" data-error-for="name" role="alert"></span>
            </div>

            <div class="ef-field">
              <label for="su-email">${escapeHtml(at.emailLabel)}</label>
              <input id="su-email" name="email" type="email" autocomplete="email" placeholder="${escapeHtml(at.emailPlaceholder)}" required aria-describedby="su-email-err">
              <span id="su-email-err" class="ef-field-error" data-error-for="email" role="alert"></span>
            </div>

            <div class="ef-field">
              <label for="su-org">${escapeHtml(at.orgLabel)}</label>
              <input id="su-org" name="org" type="text" autocomplete="organization" placeholder="${escapeHtml(at.orgPlaceholder)}" maxlength="100">
            </div>

            <div class="ef-field">
              <label for="su-password">${escapeHtml(at.newPasswordLabel)}</label>
              <div class="ef-password-wrap">
                <input id="su-password" name="password" type="password" autocomplete="new-password" placeholder="${escapeHtml(at.newPasswordPlaceholder)}" required minlength="8" data-password-input aria-describedby="su-password-err">
                <button type="button" class="ef-password-toggle" data-toggle-password="su-password" aria-pressed="false" aria-label="${escapeHtml(at.showPassword)}">
                  ${eyeIconSvg()}
                </button>
              </div>
              <div class="ef-strength-meter" data-strength-meter data-score="0" aria-live="polite">
                <div class="ef-strength-bars" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
                <span class="ef-strength-label" data-strength-label>Password strength: waiting for input</span>
              </div>
              <span id="su-password-err" class="ef-field-error" data-error-for="password" role="alert"></span>
            </div>

            <div>
              <label class="ef-consent">
                <input type="checkbox" name="terms" required aria-describedby="su-terms-err">
                <span>${escapeHtml(at.acceptTerms)}</span>
              </label>
              <span id="su-terms-err" class="ef-field-error" data-error-for="terms" role="alert"></span>
            </div>

            <button class="ef-btn ef-btn-primary ef-btn-full" type="submit">
              <span>${escapeHtml(at.signupSubmit)}</span>
              ${arrowRightIcon()}
            </button>

            <p class="ef-form-banner" role="status" data-form-status>UI blueprint ready — creates a local preview session until wired to your backend.</p>
          </form>

          <p class="ef-auth-switch">
            <span>${escapeHtml(at.hasAccount)}</span>
            <a href="${hrefFor("/signin", locale)}">${escapeHtml(at.signInLink)}</a>
          </p>
        </div>
      </div>
      ${googleConsentModalHtml(at, escapeHtml)}
    </section>`;
  }

  if (type === "auth-forgot") {
    return `<section class="ef-auth-section">
      <div class="ef-container ef-auth-single-wrap">
        <div class="ef-auth-card">
          <p class="ef-eyebrow">${escapeHtml(at.eyebrowForgot)}</p>
          <h1 class="ef-auth-card-title">${escapeHtml(at.forgotTitle)}</h1>
          <p class="ef-auth-card-lead">${escapeHtml(at.forgotLead)}</p>

          <form class="ef-auth-form ef-mt-20" data-auth-form="forgot" novalidate>
            <div class="ef-field">
              <label for="fp-email">${escapeHtml(at.emailLabel)}</label>
              <input id="fp-email" name="email" type="email" autocomplete="email" placeholder="${escapeHtml(at.emailPlaceholder)}" required aria-describedby="fp-email-err">
              <span id="fp-email-err" class="ef-field-error" data-error-for="email" role="alert"></span>
            </div>

            <button class="ef-btn ef-btn-primary ef-btn-full" type="submit">
              <span>${escapeHtml(at.forgotSubmit)}</span>
              ${arrowRightIcon()}
            </button>

            <p class="ef-form-banner" role="status" data-form-status>No email is sent in preview mode. Connect <code>POST /api/auth/forgot-password</code> on your backend.</p>
          </form>

          <p class="ef-auth-switch">
            <a href="${hrefFor("/signin", locale)}">${escapeHtml(at.backToSignin)}</a>
          </p>
        </div>
      </div>
    </section>`;
  }

  // auth-account: Complete Account Management & Google Identity Linking Console
  return `<section class="ef-page-hero">
    <div class="ef-container ef-account-hero-row">
      <div>
        <p class="ef-eyebrow">${escapeHtml(at.eyebrowAccount)}</p>
        <h1>${escapeHtml(at.accountTitle)}</h1>
        <p class="ef-page-lead">${escapeHtml(at.accountLead)}</p>
      </div>
      <div class="ef-account-hero-actions">
        <span class="ef-badge ef-badge-dev">
          <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
          <span>${escapeHtml(at.blueprintBadge)}</span>
        </span>
        <button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-account-signout data-redirect-signin="${hrefFor("/signin", locale)}">
          <span>${escapeHtml(at.signOutBtn)}</span>
        </button>
      </div>
    </div>
  </section>

  <section class="ef-section" data-account-workspace>
    <div class="ef-container ef-account-grid">
      <!-- Column 1: Profile + Active Sessions -->
      <div class="ef-account-col">
        <article class="ef-account-card">
          <div class="ef-account-card-head">
            <div class="ef-account-identity">
              <span class="ef-avatar-circle ef-avatar-lg" data-acc-avatar>EF</span>
              <div>
                <h2 data-acc-display-name>ExportFlow Developer</h2>
                <p class="ef-acc-email-line">
                  <span data-acc-email>developer@exportflow.me</span>
                  <span class="ef-badge ef-badge-available"><span>Verified preview</span></span>
                </p>
              </div>
            </div>
          </div>

          <h3 class="ef-account-subhead">${escapeHtml(at.profileTitle)}</h3>
          <form class="ef-auth-form" data-account-profile-form novalidate>
            <div class="ef-field-row">
              <div class="ef-field">
                <label for="acc-name">${escapeHtml(at.nameLabel)}</label>
                <input id="acc-name" name="name" type="text" value="ExportFlow Developer" required maxlength="100">
              </div>
              <div class="ef-field">
                <label for="acc-org">${escapeHtml(at.orgLabel)}</label>
                <input id="acc-org" name="org" type="text" value="Local Execution Lab" maxlength="100">
              </div>
            </div>
            <div class="ef-account-form-foot">
              <button type="submit" class="ef-btn ef-btn-primary ef-btn-sm">${escapeHtml(at.saveProfile)}</button>
              <span class="ef-acc-save-note" data-profile-status aria-live="polite">Saved locally</span>
            </div>
          </form>
        </article>

        <article class="ef-account-card">
          <div class="ef-account-card-head">
            <div>
              <h2>${escapeHtml(at.sessionsTitle)}</h2>
              <p class="ef-acc-card-desc">${escapeHtml(at.sessionsDesc)}</p>
            </div>
          </div>

          <ul class="ef-session-list" data-session-list>
            <li class="ef-session-row" data-session-id="sess-current">
              <div>
                <strong>Current browser session</strong>
                <p>Web UI · HTTPS · Active now</p>
              </div>
              <span class="ef-badge ef-badge-available"><span>Current</span></span>
            </li>
            <li class="ef-session-row" data-session-id="sess-cli">
              <div>
                <strong>Local CLI / Worker token</strong>
                <p>127.0.0.1 · Token prefix ef_dev_***</p>
              </div>
              <button type="button" class="ef-code-btn" data-revoke-session="sess-cli">${escapeHtml(at.revokeBtn)}</button>
            </li>
            <li class="ef-session-row" data-session-id="sess-staging">
              <div>
                <strong>Preview API Client</strong>
                <p>OAuth PKCE session · Issued 2h ago</p>
              </div>
              <button type="button" class="ef-code-btn" data-revoke-session="sess-staging">${escapeHtml(at.revokeBtn)}</button>
            </li>
          </ul>
        </article>
      </div>

      <!-- Column 2: Google Identity Linking + Security + Contract -->
      <div class="ef-account-col">
        <article class="ef-account-card">
          <div class="ef-account-card-head">
            <div>
              <h2>${escapeHtml(at.providersTitle)}</h2>
              <p class="ef-acc-card-desc">${escapeHtml(at.providersDesc)}</p>
            </div>
          </div>

          <!-- Google Provider Card -->
          <div class="ef-provider-card" data-google-provider-card data-linked="false">
            <div class="ef-provider-main">
              <span class="ef-provider-logo">${googleMarkSvg()}</span>
              <div class="ef-provider-info">
                <div class="ef-provider-title-row">
                  <strong>${escapeHtml(at.googleProviderName)}</strong>
                  <span class="ef-badge ef-badge-planned" data-google-status-badge>
                    <span data-google-status-text>${escapeHtml(at.unlinkedBadge)}</span>
                  </span>
                </div>
                <p data-google-sub-detail>No Google identity linked yet. Connect to enable one-click OAuth sign-in.</p>
                <ul class="ef-provider-scopes" data-google-scopes hidden>
                  <li>openid</li>
                  <li>email</li>
                  <li>profile</li>
                </ul>
              </div>
            </div>
            <div class="ef-provider-actions">
              <button type="button" class="ef-google-btn ef-google-btn-sm" data-google-oauth-btn data-google-mode="link">
                ${googleMarkSvg()}
                <span>${escapeHtml(at.googleConnect)}</span>
              </button>
              <button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-google-unlink-btn hidden>
                <span>${escapeHtml(at.googleDisconnect)}</span>
              </button>
            </div>
          </div>

          <!-- Email/Password Provider Card -->
          <div class="ef-provider-card ef-mt-12">
            <div class="ef-provider-main">
              <span class="ef-provider-logo ef-provider-logo-mail">
                <svg class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
              </span>
              <div class="ef-provider-info">
                <div class="ef-provider-title-row">
                  <strong>${escapeHtml(at.emailProviderName)}</strong>
                  <span class="ef-badge ef-badge-available"><span>${escapeHtml(at.configuredBadge)}</span></span>
                </div>
                <p data-email-provider-detail>Primary fallback credential for local &amp; email sign-in.</p>
              </div>
            </div>
          </div>
        </article>

        <article class="ef-account-card">
          <div class="ef-account-card-head">
            <div>
              <h2>${escapeHtml(at.securityTitle)}</h2>
              <p class="ef-acc-card-desc">${escapeHtml(at.securityDesc)}</p>
            </div>
            <span class="ef-badge ef-badge-planned" data-2fa-badge><span>Off (Preview)</span></span>
          </div>
          <div class="ef-2fa-row">
            <p class="ef-acc-card-desc">Ready for <code>POST /api/account/2fa/enroll</code> TOTP secret + recovery codes.</p>
            <button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-2fa-toggle aria-pressed="false">${escapeHtml(at.enable2fa)}</button>
          </div>
        </article>

        ${backendContractCard(at, escapeHtml)}
      </div>
    </div>
    ${googleConsentModalHtml(at, escapeHtml)}
  </section>`;
}
