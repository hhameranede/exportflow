export const AUTH_ROUTES = [
  ["/signin", "Sign in", "Sign in to your ExportFlow workspace.", "auth-signin"],
  ["/signup", "Create account", "Create your ExportFlow developer account.", "auth-signup"],
  ["/forgot-password", "Reset password", "Request a secure password reset link.", "auth-forgot"],
  ["/reset-password", "Choose a new password", "Set a new password for your ExportFlow account.", "auth-reset"],
  ["/account", "Account", "Manage your ExportFlow profile, connected accounts, security, and sessions.", "auth-account"],
  ["/workspace", "Workspace", "Run bounded HTTP tasks, manage workspace API keys, and inspect execution history.", "auth-workspace"],
  ["/oauth/consent", "Authorize ExportFlow", "Review the permissions requested by this application.", "auth-oauth-consent"],
  ["/oauth/select-tenant", "Select a workspace", "Choose the ExportFlow workspace for this connection.", "auth-oauth-select-tenant"],
];

const EN_COPY = {
  accountNavLabel: "Account",
  workspaceNavLabel: "Workspace",
  signInKicker: "Account Access",
  signUpKicker: "Developer Onboarding",
  forgotKicker: "Account Recovery",
  resetKicker: "Account Security",
  accountKicker: "Workspace Identity",
  workspaceKicker: "Execution Workspace",
  signInTitle: "Sign in to ExportFlow",
  signInLead: "Sign in to unlock the execution workbench, live HTTP runner, API keys, and workspace tools.",
  signUpTitle: "Create your account",
  signUpLead: "Create one secure ExportFlow identity to access interactive platform features.",
  forgotTitle: "Recover your password",
  forgotLead: "Enter your account email and we will prepare a secure password reset link.",
  resetTitle: "Choose a new password",
  resetLead: "Set a strong password of at least 8 characters for your ExportFlow account.",
  accountTitle: "Account & Security",
  accountLead: "Manage your personal profile, authenticator 2FA, password, connected providers, and active sessions.",
  workspaceTitle: "Execution Workspace",
  workspaceLead: "Run bounded HTTP(S) fetches through ExportFlow core adapters, manage personal keys, and inspect provenance history.",
  google: "Continue with Google",
  orEmail: "or use email",
  checking: "Checking account services…",
  unavailable: "Account services are not configured yet.",
  emailDisabled: "Email and password sign-in are not enabled yet.",
  name: "Full name",
  email: "Email address",
  password: "Password",
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Confirm password",
  rememberDevice: "Keep me signed in on this device",
  forgotPasswordLink: "Forgot password?",
  newToExportFlow: "New to ExportFlow?",
  alreadyHaveAccount: "Already have an account?",
  backToSignIn: "Back to sign in",
  create: "Create account",
  signIn: "Sign in",
  sendReset: "Send recovery link",
  savePassword: "Update password",
  save: "Save changes",
  cancel: "Cancel",
  signOut: "Sign out",
  openWorkspace: "Open Workspace",
  openAccount: "Account settings",
  resendVerifyPrompt: "Need a fresh verification link?",
  resendVerifyBtn: "Resend verification email",
  profile: "Profile",
  profileDesc: "Your verified account identity.",
  security: "Security & Authentication",
  securityDesc: "Configure TOTP two-factor protection and rotate your password.",
  connected: "Connected accounts",
  connectedDesc: "Manage identity providers linked to this account.",
  sessions: "Active sessions",
  sessionsDesc: "Review devices signed into your account and revoke access anytime.",
  revokeAll: "Sign out other sessions",
  sessionReauth: "Your session needs a fresh sign-in before you can view or manage other sessions.",
  sessionUnavailable: "Sessions could not be loaded right now. Your profile and security settings remain available.",
  loading: "Verifying your session…",
  profileUpdated: "Profile updated.",
  verifyEmail: "Check your verification link below to activate your account.",
  resetSent: "If this email is registered, a password recovery link is ready.",
  accountDisabled: "Your session has expired. Sign in again.",
  noSessions: "No other active sessions were found.",
  noAccounts: "No linked social accounts.",
  linkGoogle: "Connect Google",
  unlinkGoogle: "Disconnect",
  currentSession: "Current session",
  revoke: "Revoke",
  passwordMismatch: "Passwords do not match.",
  minimumPassword: "Use at least 8 characters.",
  strengthHint: "Use 8+ characters with uppercase, numbers, or symbols",
  showPassword: "Show password",
  hidePassword: "Hide password",
  emailOnly: "Email recovery is currently unavailable.",
  accountUnavailable: "The account service is temporarily unavailable.",
  totpChecking: "Checking authenticator status…",
  totpPasswordLabel: "Account password (for password-based accounts)",
  totpSetupDesc: "Protect your workspace with a 6-digit TOTP authenticator. Save the backup codes offline.",
  totpSetupBtn: "Set up authenticator",
  totpVerifyDesc: "Add this key in your authenticator app, then enter the current 6-digit code to finish setup.",
  totpKeyTitle: "Authenticator setup key",
  totpCopyKey: "Copy setup key",
  totpCodeLabel: "Six-digit authenticator code",
  totpVerifyBtn: "Verify authenticator",
  changePasswordHeading: "Change password",
  changePasswordBtn: "Change password",
  verifiedBadge: "Verified",
  unverifiedBadge: "Verification pending",
  statKeys: "Active API keys",
  statRuns: "Executions run",
  statMaxCap: "Response limit",
  statAdapter: "Active adapter",
  execTitle: "Live Bounded HTTP Executor",
  execDesc: "Execute real public HTTPS/HTTP requests through ExportFlow egress guards and inspect full evidence envelopes.",
  execGoal: "Task goal",
  execDefaultGoal: "Fetch and verify public page headers",
  execUrl: "Target public URL",
  execMode: "Execution mode",
  execModeLive: "Live HTTP Fetch (outbound via server)",
  execModeSim: "Policy Dry-Run (0 external requests)",
  execRun: "Execute Task",
  execOutput: "Execution Output & Provenance",
  execOutputDesc: "Structured Task Result envelope & provenance sources.",
  maxRedirectsLabel: "Max Redirects (0–3)",
  timeoutLabel: "Timeout ms (100–8000)",
  maxBytesLabel: "Max Bytes (64–1048576)",
  keysTitle: "Workspace API Keys",
  keysDesc: "Generate scoped keys for local scripts and inspect active credentials. Secrets are shown only once on creation.",
  keyNameLabel: "Key label",
  keyNamePlaceholder: "e.g. Local agent runner",
  keyCreateBtn: "Create API Key",
  createdOnce: "Created once",
  copyNewKey: "Copy your new API key",
  copyKeyBtn: "Copy key",
  historyTitle: "Execution History",
  historyDesc: "Recent task executions recorded under your authenticated account.",
  historyClear: "Clear history",
  idleBadge: "Idle",
  jsonResponse: "JSON Response",
  copyBtn: "Copy",
  idleOutputHint: "Run a task to inspect live output & source evidence.",
  workspaceMember: "Workspace Member",
  accountMember: "ExportFlow Member",
  localMailbox: "Local Mailbox Delivery",
  openSecureLink: "Open secure link",
  oauthConsentKicker: "Account Permissions",
  oauthConsentTitle: "Authorize ExportFlow",
  oauthConsentLead: "Review the access requested before connecting this application.",
  oauthConsentDesc: "An application is requesting access to your ExportFlow account.",
  clientIdLabel: "Client ID",
  unknownApp: "Unknown application",
  requestedPermissions: "Requested permissions",
  oauthConsentNote: "Only approve this connection if you recognize the application and agree with these permissions. You can disconnect access later by revoking its authorization.",
  authorizeBtn: "Authorize",
  cancelBtn: "Cancel",
  oauthSelectKicker: "Workspace Access",
  oauthSelectTitle: "Choose a workspace",
  oauthSelectLead: "Select the workspace this AI connection should access.",
  workspaceLabel: "ExportFlow workspace",
  loadingWorkspaces: "Loading workspaces…",
  oauthSelectNote: "The selected workspace determines which account data and usage allowance this connection can access.",
  continueBtn: "Continue",
  backupCodesLabel: "One-time backup codes",
};

const COPY = {
  en: EN_COPY,
  ar: {
    accountNavLabel: "الحساب",
    workspaceNavLabel: "مساحة العمل",
    signInKicker: "الدخول إلى الحساب",
    signUpKicker: "حساب مطوّر جديد",
    forgotKicker: "استرداد الحساب",
    resetKicker: "أمان الحساب",
    accountKicker: "إدارة الهوية",
    workspaceKicker: "مساحة التنفيذ",
    signInTitle: "تسجيل الدخول إلى ExportFlow",
    signInLead: "سجّل الدخول لفتح منصة التنفيذ التفاعلية، منفّذ HTTP المباشر، مفاتيح API، وإدارة الجلسات.",
    signUpTitle: "إنشاء حساب جديد",
    signUpLead: "أنشئ هوية آمنة واحدة للوصول إلى جميع ميزات وأدوات ExportFlow التفاعلية.",
    forgotTitle: "استرداد كلمة المرور",
    forgotLead: "أدخل بريدك الإلكتروني وسنجهّز لك رابط استعادة آمن لإعادة تعيين كلمة المرور.",
    resetTitle: "اختيار كلمة مرور جديدة",
    resetLead: "عيّن كلمة مرور قوية لا تقل عن 8 أحرف لحماية حسابك في ExportFlow.",
    accountTitle: "الحساب والأمان",
    accountLead: "أدر بياناتك الشخصية، التحقق الثنائي TOTP، كلمة المرور، المزودين المرتبطين، والجلسات النشطة.",
    workspaceTitle: "مساحة التنفيذ",
    workspaceLead: "نفّذ طلبات HTTP(S) منضبطة عبر محركات ExportFlow، وأدر مفاتيح API وسجل الأدلة الخاص بك.",
    google: "المتابعة باستخدام Google",
    orEmail: "أو عبر البريد الإلكتروني",
    checking: "جارٍ التحقق من خدمات الحساب…",
    unavailable: "خدمات الحساب غير مهيأة بعد.",
    emailDisabled: "تسجيل الدخول بالبريد وكلمة المرور غير مفعّل حالياً.",
    name: "الاسم الكامل",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    rememberDevice: "تذكّر تسجيل دخولي على هذا الجهاز",
    forgotPasswordLink: "نسيت كلمة المرور؟",
    newToExportFlow: "جديد في ExportFlow؟",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    backToSignIn: "العودة لتسجيل الدخول",
    create: "إنشاء الحساب",
    signIn: "تسجيل الدخول",
    sendReset: "إرسال رابط الاسترداد",
    savePassword: "تحديث كلمة المرور",
    save: "حفظ التغييرات",
    cancel: "إلغاء",
    signOut: "تسجيل الخروج",
    openWorkspace: "فتح مساحة العمل",
    openAccount: "إعدادات الحساب",
    resendVerifyPrompt: "تحتاج رابط تفعيل جديد؟",
    resendVerifyBtn: "إعادة إرسال رابط التفعيل",
    profile: "الملف الشخصي",
    profileDesc: "معلومات هويتك المؤكدة.",
    security: "الأمان والمصادقة",
    securityDesc: "فعّل المصادقة الثنائية TOTP وحدّث كلمة مرورك.",
    connected: "الحسابات المرتبطة",
    connectedDesc: "أدر مزودي الهوية المرتبطين بهذا الحساب.",
    sessions: "الجلسات النشطة",
    sessionsDesc: "راجع الأجهزة المتصلة بحسابك وأنهِ أي جلسة فوراً.",
    revokeAll: "إنهاء الجلسات الأخرى",
    sessionReauth: "يلزم تسجيل الدخول مجدداً لإدارة الجلسات الأخرى.",
    sessionUnavailable: "تعذر تحميل الجلسات حالياً، وتبقى إعدادات ملفك الشخصي متاحة.",
    loading: "جارٍ التحقق من الجلسة…",
    profileUpdated: "تم تحديث الملف الشخصي.",
    verifyEmail: "افتح رابط التفعيل أدناه لتفعيل حسابك والدخول مباشرة.",
    resetSent: "إذا كان البريد مسجلاً، فقد تم تجهيز رابط استرداد كلمة المرور.",
    accountDisabled: "انتهت جلستك. يرجى تسجيل الدخول مجدداً.",
    noSessions: "لا توجد جلسات نشطة أخرى.",
    noAccounts: "لا توجد حسابات اجتماعية مرتبطة.",
    linkGoogle: "ربط Google",
    unlinkGoogle: "إلغاء الربط",
    currentSession: "الجلسة الحالية",
    revoke: "إنهاء",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    minimumPassword: "استعمل 8 أحرف على الأقل.",
    strengthHint: "استخدم 8+ أحرف مع أحرف كبيرة وأرقام أو رموز",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    emailOnly: "استرداد البريد غير متاح حالياً.",
    accountUnavailable: "خدمة الحساب غير متاحة مؤقتاً.",
    totpChecking: "جارٍ فحص حالة المصادقة الثنائية…",
    totpPasswordLabel: "كلمة مرور الحساب (للحسابات المسجلة بكلمة مرور)",
    totpSetupDesc: "احمِ حسابك برمز تحقق سداسي TOTP. احفظ رموز الاسترداد الاحتياطية في مكان آمن.",
    totpSetupBtn: "تفعيل تطبيق المصادقة",
    totpVerifyDesc: "أضف هذا المفتاح في تطبيق المصادقة، ثم أدخل الرمز السداسي الحالي لإتمام التفعيل.",
    totpKeyTitle: "مفتاح إعداد المصادقة",
    totpCopyKey: "نسخ مفتاح الإعداد",
    totpCodeLabel: "رمز التحقق المكوّن من 6 أرقام",
    totpVerifyBtn: "تأكيد التفعيل",
    changePasswordHeading: "تغيير كلمة المرور",
    changePasswordBtn: "تحديث كلمة المرور",
    verifiedBadge: "بريد مؤكد",
    unverifiedBadge: "بانتظار التأكيد",
    statKeys: "المفاتيح النشطة",
    statRuns: "عمليات التنفيذ",
    statMaxCap: "الحد الأقصى للاستجابة",
    statAdapter: "المحرك النشط",
    execTitle: "منفّذ HTTP المباشر والمنضبط",
    execDesc: "نفّذ طلبات HTTPS/HTTP حقيقية عبر حواجز الأمان في ExportFlow واستعرض سجل الأدلة الكامل.",
    execGoal: "هدف المهمة",
    execDefaultGoal: "جلب وفحص ترويسات الصفحة العامة",
    execUrl: "الرابط العام المستهدف",
    execMode: "وضع التنفيذ",
    execModeLive: "تنفيذ مباشر (طلب فعلي عبر الخادم)",
    execModeSim: "فحص السياسة فقط (0 طلبات خارجية)",
    execRun: "تنفيذ المهمة",
    execOutput: "نتيجة التنفيذ وسجل الأدلة",
    execOutputDesc: "بنية نتيجة المهمة الموحدة ومصادر الأدلة.",
    maxRedirectsLabel: "أقصى إعادة توجيه (0–3)",
    timeoutLabel: "المهلة مللي ثانية (100–8000)",
    maxBytesLabel: "أقصى حجم بايت (64–1048576)",
    keysTitle: "مفاتيح API الخاصة بك",
    keysDesc: "أنشئ مفاتيح خاصة لأدواتك وراقب المفاتيح النشطة. يظهر الرمز السري مرة واحدة عند الإنشاء.",
    keyNameLabel: "اسم المفتاح",
    keyNamePlaceholder: "مثال: وكيل البحث المحلي",
    keyCreateBtn: "إنشاء مفتاح API",
    createdOnce: "يظهر مرة واحدة",
    copyNewKey: "انسخ مفتاح API الجديد",
    copyKeyBtn: "نسخ المفتاح",
    historyTitle: "سجل عمليات التنفيذ",
    historyDesc: "أحدث المهام المنفذة والمسجلة تحت حسابك.",
    historyClear: "مسح السجل",
    idleBadge: "في الانتظار",
    jsonResponse: "استجابة JSON",
    copyBtn: "نسخ",
    idleOutputHint: "نفّذ مهمة لمعاينة المخرجات وسجل الأدلة هنا.",
    workspaceMember: "عضو مساحة العمل",
    accountMember: "عضو ExportFlow",
    localMailbox: "صندوق البريد المحلي",
    openSecureLink: "فتح الرابط الآمن",
    oauthConsentKicker: "صلاحيات الحساب",
    oauthConsentTitle: "تفويض ExportFlow",
    oauthConsentLead: "راجع الصلاحيات المطلوبة قبل ربط هذا التطبيق.",
    oauthConsentDesc: "يطلب أحد التطبيقات إذن الوصول إلى حسابك في ExportFlow.",
    clientIdLabel: "معرّف العميل",
    unknownApp: "تطبيق غير معروف",
    requestedPermissions: "الصلاحيات المطلوبة",
    oauthConsentNote: "وافق على الربط فقط إذا كنت تثق بالتطبيق. يمكنك إلغاء الصلاحية في أي وقت لاحقاً.",
    authorizeBtn: "موافقة وتفويض",
    cancelBtn: "إلغاء",
    oauthSelectKicker: "وصول مساحة العمل",
    oauthSelectTitle: "اختر مساحة عمل",
    oauthSelectLead: "حدد مساحة العمل التي سيصل إليها هذا الاتصال.",
    workspaceLabel: "مساحة عمل ExportFlow",
    loadingWorkspaces: "جارٍ تحميل مساحات العمل…",
    oauthSelectNote: "تحدد المساحة المختارة البيانات وحدود الاستخدام المتاحة لهذا الربط.",
    continueBtn: "متابعة",
    backupCodesLabel: "رموز الاسترداد لمرة واحدة",
  },
  fr: {
    ...EN_COPY,
    accountNavLabel: "Compte",
    workspaceNavLabel: "Espace",
    signInKicker: "Accès au compte",
    signUpKicker: "Nouveau compte",
    forgotKicker: "Récupération",
    resetKicker: "Sécurité du compte",
    accountKicker: "Identité & sécurité",
    workspaceKicker: "Espace d’exécution",
    signInTitle: "Connexion à ExportFlow",
    signInLead: "Connectez-vous pour accéder au banc d’essai, à l’exécuteur HTTP et aux clés API.",
    signUpTitle: "Créer votre compte",
    signUpLead: "Créez une identité ExportFlow sécurisée pour utiliser la plateforme.",
    forgotTitle: "Récupérer le mot de passe",
    forgotLead: "Saisissez votre e-mail pour recevoir un lien de réinitialisation sécurisé.",
    resetTitle: "Nouveau mot de passe",
    resetLead: "Définissez un mot de passe d’au moins 8 caractères.",
    accountTitle: "Compte & Sécurité",
    accountLead: "Gérez votre profil, l’authentification 2FA, le mot de passe et vos sessions actives.",
    workspaceTitle: "Espace d’exécution",
    workspaceLead: "Exécutez des requêtes HTTP(S) bornées et gérez vos clés API.",
    google: "Continuer avec Google",
    orEmail: "ou par e-mail",
    name: "Nom complet",
    email: "Adresse e-mail",
    password: "Mot de passe",
    create: "Créer un compte",
    signIn: "Se connecter",
    sendReset: "Envoyer le lien",
    savePassword: "Mettre à jour",
    save: "Enregistrer",
    cancel: "Annuler",
    signOut: "Déconnexion",
    openWorkspace: "Ouvrir l’espace",
    openAccount: "Paramètres du compte",
    forgotPasswordLink: "Mot de passe oublié ?",
    newToExportFlow: "Nouveau sur ExportFlow ?",
    alreadyHaveAccount: "Déjà un compte ?",
    backToSignIn: "Retour à la connexion",
    execRun: "Exécuter la tâche",
    keyCreateBtn: "Créer une clé API",
    historyClear: "Effacer l’historique",
    copyBtn: "Copier",
  },
  es: {
    ...EN_COPY,
    accountNavLabel: "Cuenta",
    workspaceNavLabel: "Espacio",
    signInKicker: "Acceso a cuenta",
    signUpKicker: "Registro",
    forgotKicker: "Recuperación",
    resetKicker: "Seguridad",
    accountKicker: "Identidad",
    workspaceKicker: "Espacio de ejecución",
    signInTitle: "Iniciar sesión en ExportFlow",
    signInLead: "Inicia sesión para usar el banco de pruebas, el ejecutor HTTP y tus claves API.",
    signUpTitle: "Crear tu cuenta",
    signUpLead: "Crea una cuenta segura de ExportFlow para usar la plataforma.",
    forgotTitle: "Recuperar contraseña",
    forgotLead: "Introduce tu correo para generar un enlace seguro de restablecimiento.",
    resetTitle: "Nueva contraseña",
    resetLead: "Establece una contraseña de al menos 8 caracteres.",
    accountTitle: "Cuenta y seguridad",
    accountLead: "Administra tu perfil, verificación 2FA, contraseña y sesiones activas.",
    workspaceTitle: "Espacio de ejecución",
    workspaceLead: "Ejecuta peticiones HTTP(S) acotadas y gestiona tus claves API.",
    google: "Continuar con Google",
    orEmail: "o con correo",
    name: "Nombre completo",
    email: "Correo electrónico",
    password: "Contraseña",
    create: "Crear cuenta",
    signIn: "Iniciar sesión",
    sendReset: "Enviar enlace",
    savePassword: "Actualizar",
    save: "Guardar cambios",
    cancel: "Cancelar",
    signOut: "Cerrar sesión",
    openWorkspace: "Abrir espacio",
    openAccount: "Ajustes de cuenta",
    forgotPasswordLink: "¿Olvidaste tu contraseña?",
    newToExportFlow: "¿Nuevo en ExportFlow?",
    alreadyHaveAccount: "¿Ya tienes cuenta?",
    backToSignIn: "Volver al inicio de sesión",
    execRun: "Ejecutar tarea",
    keyCreateBtn: "Crear clave API",
    historyClear: "Limpiar historial",
    copyBtn: "Copiar",
  },
  de: {
    ...EN_COPY,
    accountNavLabel: "Konto",
    workspaceNavLabel: "Arbeitsbereich",
    signInKicker: "Kontozugang",
    signUpKicker: "Registrierung",
    forgotKicker: "Wiederherstellung",
    resetKicker: "Kontosicherheit",
    accountKicker: "Identität",
    workspaceKicker: "Ausführungsbereich",
    signInTitle: "Bei ExportFlow anmelden",
    signInLead: "Melde dich an, um die Testumgebung, HTTP-Ausführung und API-Schlüssel zu nutzen.",
    signUpTitle: "Konto erstellen",
    signUpLead: "Erstelle ein sicheres ExportFlow-Konto für alle Plattformfunktionen.",
    forgotTitle: "Passwort zurücksetzen",
    forgotLead: "Gib deine E-Mail-Adresse für einen sicheren Wiederherstellungslink ein.",
    resetTitle: "Neues Passwort wählen",
    resetLead: "Wähle ein Passwort mit mindestens 8 Zeichen.",
    accountTitle: "Konto & Sicherheit",
    accountLead: "Verwalte Profil, 2FA-Authenticator, Passwort und aktive Sitzungen.",
    workspaceTitle: "Ausführungsbereich",
    workspaceLead: "Führe begrenzte HTTP(S)-Anfragen aus und verwalte API-Schlüssel.",
    google: "Mit Google fortfahren",
    orEmail: "oder mit E-Mail",
    name: "Vollständiger Name",
    email: "E-Mail-Adresse",
    password: "Passwort",
    create: "Konto erstellen",
    signIn: "Anmelden",
    sendReset: "Link senden",
    savePassword: "Aktualisieren",
    save: "Speichern",
    cancel: "Abbrechen",
    signOut: "Abmelden",
    openWorkspace: "Arbeitsbereich öffnen",
    openAccount: "Kontoeinstellungen",
    forgotPasswordLink: "Passwort vergessen?",
    newToExportFlow: "Neu bei ExportFlow?",
    alreadyHaveAccount: "Bereits registriert?",
    backToSignIn: "Zurück zur Anmeldung",
    execRun: "Aufgabe ausführen",
    keyCreateBtn: "API-Schlüssel erstellen",
    historyClear: "Verlauf löschen",
    copyBtn: "Kopieren",
  },
  pt: {
    ...EN_COPY,
    accountNavLabel: "Conta",
    workspaceNavLabel: "Espaço",
    signInKicker: "Acesso à conta",
    signUpKicker: "Cadastro",
    forgotKicker: "Recuperação",
    resetKicker: "Segurança",
    accountKicker: "Identidade",
    workspaceKicker: "Espaço de execução",
    signInTitle: "Entrar no ExportFlow",
    signInLead: "Entre para liberar o ambiente interativo, executor HTTP e chaves de API.",
    signUpTitle: "Criar sua conta",
    signUpLead: "Crie uma identidade ExportFlow segura para acessar os recursos da plataforma.",
    forgotTitle: "Recuperar senha",
    forgotLead: "Informe seu e-mail para preparar um link seguro de redefinição.",
    resetTitle: "Escolher nova senha",
    resetLead: "Defina uma senha com pelo menos 8 caracteres.",
    accountTitle: "Conta e Segurança",
    accountLead: "Gerencie seu perfil, autenticação 2FA, senha e sessões ativas.",
    workspaceTitle: "Espaço de Execução",
    workspaceLead: "Execute chamadas HTTP(S) limitadas e gerencie suas chaves de API.",
    google: "Continuar com o Google",
    orEmail: "ou usar e-mail",
    name: "Nome completo",
    email: "Endereço de e-mail",
    password: "Senha",
    create: "Criar conta",
    signIn: "Entrar",
    sendReset: "Enviar link",
    savePassword: "Atualizar",
    save: "Salvar alterações",
    cancel: "Cancelar",
    signOut: "Sair",
    openWorkspace: "Abrir Espaço",
    openAccount: "Configurações da conta",
    forgotPasswordLink: "Esqueceu a senha?",
    newToExportFlow: "Novo no ExportFlow?",
    alreadyHaveAccount: "Já tem uma conta?",
    backToSignIn: "Voltar ao login",
    execRun: "Executar tarefa",
    keyCreateBtn: "Criar chave API",
    historyClear: "Limpar histórico",
    copyBtn: "Copiar",
  },
  zh: {
    ...EN_COPY,
    accountNavLabel: "账户",
    workspaceNavLabel: "工作台",
    signInKicker: "账户登录",
    signUpKicker: "开发者注册",
    forgotKicker: "找回账户",
    resetKicker: "账户安全",
    accountKicker: "身份与安全",
    workspaceKicker: "执行工作台",
    signInTitle: "登录 ExportFlow",
    signInLead: "登录后即可使用交互工作台、实时 HTTP 执行器、API 密钥和会话管理。",
    signUpTitle: "创建账户",
    signUpLead: "创建一个安全的 ExportFlow 账户以访问交互式平台功能。",
    forgotTitle: "找回密码",
    forgotLead: "输入您的账户邮箱，我们将生成安全的密码重置链接。",
    resetTitle: "设置新密码",
    resetLead: "请为您的 ExportFlow 账户设置至少 8 位密码。",
    accountTitle: "账户与安全",
    accountLead: "管理您的个人资料、TOTP 双重验证、密码与活动会话。",
    workspaceTitle: "执行工作台",
    workspaceLead: "通过 ExportFlow 核心适配器执行有界 HTTP(S) 请求并管理 API 密钥。",
    google: "使用 Google 继续",
    orEmail: "或使用邮箱",
    name: "姓名",
    email: "电子邮箱",
    password: "密码",
    create: "创建账户",
    signIn: "登录",
    sendReset: "发送重置链接",
    savePassword: "更新密码",
    save: "保存更改",
    cancel: "取消",
    signOut: "退出登录",
    openWorkspace: "打开工作台",
    openAccount: "账户设置",
    forgotPasswordLink: "忘记密码？",
    newToExportFlow: "还没有账户？",
    alreadyHaveAccount: "已有账户？",
    backToSignIn: "返回登录",
    execRun: "执行任务",
    keyCreateBtn: "创建 API 密钥",
    historyClear: "清空记录",
    copyBtn: "复制",
  },
  ja: {
    ...EN_COPY,
    accountNavLabel: "アカウント",
    workspaceNavLabel: "ワークスペース",
    signInKicker: "アカウントログイン",
    signUpKicker: "新規登録",
    forgotKicker: "アカウント復旧",
    resetKicker: "セキュリティ",
    accountKicker: "アカウント管理",
    workspaceKicker: "実行ワークスペース",
    signInTitle: "ExportFlow にサインイン",
    signInLead: "サインインして実行ワークベンチ、HTTPエグゼキューター、APIキーを利用できます。",
    signUpTitle: "アカウント作成",
    signUpLead: "ExportFlowの対話機能を利用するためのアカウントを作成します。",
    forgotTitle: "パスワードをリセット",
    forgotLead: "ご登録のメールアドレスに安全なリセットリンクを準備します。",
    resetTitle: "新しいパスワード",
    resetLead: "8文字以上のパスワードを設定してください。",
    accountTitle: "アカウントとセキュリティ",
    accountLead: "プロフィール、2要素認証(TOTP)、パスワード、セッションを管理します。",
    workspaceTitle: "実行ワークスペース",
    workspaceLead: "境界付き HTTP(S) リクエストの実行と API キー管理を行います。",
    google: "Google で続ける",
    orEmail: "またはメールで",
    name: "氏名",
    email: "メールアドレス",
    password: "パスワード",
    create: "アカウント作成",
    signIn: "サインイン",
    sendReset: "リンクを送信",
    savePassword: "パスワード更新",
    save: "変更を保存",
    cancel: "キャンセル",
    signOut: "サインアウト",
    openWorkspace: "ワークスペースを開く",
    openAccount: "アカウント設定",
    forgotPasswordLink: "パスワードをお忘れですか？",
    newToExportFlow: "アカウントをお持ちでないですか？",
    alreadyHaveAccount: "すでにアカウントをお持ちですか？",
    backToSignIn: "サインインに戻る",
    execRun: "タスクを実行",
    keyCreateBtn: "API キーを作成",
    historyClear: "履歴を消去",
    copyBtn: "コピー",
  },
};

function googleMark() {
  return '<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7.3 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.4 28.6a14.5 14.5 0 0 1 0-9.2l-7.8-6.1a24 24 0 0 0 0 21.4z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.7l-7.3-5.7c-2 1.3-4.6 2.1-8.7 2.1-6.3 0-11.7-4.2-13.6-10.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
}

function eyeIcon() {
  return '<svg data-eye-open width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
    '<svg data-eye-closed width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

function strengthMeterHtml(inputId, c, escapeHtml) {
  return '<div class="ef-strength-meter" data-strength-meter="' + inputId + '" data-score="0">' +
    '<div class="ef-strength-bars" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
    '<span class="ef-strength-label" data-strength-label>' + escapeHtml(c.strengthHint) + '</span>' +
    '</div>';
}

function field(id, name, label, type, autocomplete, placeholder, escapeHtml, options = {}) {
  const isPassword = type === "password";
  const dirAttr = type === "email" || type === "url" ? ' class="ef-ltr-input"' : "";
  const extraAttrs = options.minlength ? ' minlength="' + options.minlength + '"' : "";
  const inputHtml = '<input id="' + id + '" name="' + name + '" type="' + type + '"' + dirAttr +
    ' autocomplete="' + autocomplete + '"' +
    (placeholder ? ' placeholder="' + escapeHtml(placeholder) + '"' : "") + extraAttrs + ' required>';

  const wrappedInput = isPassword
    ? '<div class="ef-password-wrap">' + inputHtml +
      '<button type="button" class="ef-password-toggle" data-password-toggle="' + id + '" aria-pressed="false" aria-label="' + escapeHtml(options.showPasswordLabel || "Show password") + '" title="' + escapeHtml(options.showPasswordLabel || "Show password") + '">' +
      eyeIcon() + '</button></div>'
    : inputHtml;

  const meter = isPassword && options.withStrength && options.copy
    ? strengthMeterHtml(id, options.copy, escapeHtml)
    : "";

  return '<div class="ef-field"><label for="' + id + '">' + escapeHtml(label) + '</label>' +
    wrappedInput + meter +
    '<span class="ef-field-error" data-auth-field-error="' + name + '" role="alert"></span></div>';
}

function authFrame(_kicker, title, lead, content, wide = false) {
  const containerClass = wide ? "ef-container ef-auth-wide-wrap" : "ef-container ef-auth-single-wrap";
  if (wide) {
    return '<section class="ef-auth-section ef-auth-section-wide" data-auth-page>' +
      '<div class="' + containerClass + '">' +
      '<div class="ef-auth-page-head">' +
        '<h1 class="ef-auth-title">' + title + '</h1>' +
        '<p class="ef-auth-lead">' + lead + '</p>' +
      '</div>' +
      content +
      '</div></section>';
  }
  return '<section class="ef-auth-section" data-auth-page>' +
    '<div class="' + containerClass + '"><div class="ef-auth-card">' +
    '<h1 class="ef-auth-card-title">' + title + '</h1>' +
    '<p class="ef-auth-card-lead">' + lead + '</p>' +
    content +
    '</div></div></section>';
}

function googleAction(label, mode) {
  return '<button type="button" class="ef-google-btn" data-auth-google data-auth-google-mode="' + mode + '" disabled hidden>' +
    googleMark() + '<span>' + label + '</span></button>';
}

function emailForm(mode, label, fields, buttonLabel, escapeHtml, extraHtml = "") {
  return '<form class="ef-auth-form" data-auth-form="' + mode + '" hidden novalidate>' +
    fields.join("") +
    extraHtml +
    '<button type="submit" class="ef-btn ef-btn-primary ef-btn-full"><span>' + escapeHtml(buttonLabel) + '</span></button>' +
    '<p class="ef-form-banner" data-auth-form-status role="status" aria-live="polite"></p>' +
    '</form>';
}

function devMailboxBox(c, escapeHtml) {
  return '<div class="ef-dev-mailbox" data-dev-mailbox-box hidden>' +
    '<div class="ef-dev-mailbox-head">' +
      '<span class="ef-badge ef-badge-available"><span>' + escapeHtml(c.localMailbox) + '</span></span>' +
      '<strong data-dev-mailbox-subject></strong>' +
    '</div>' +
    '<p class="ef-acc-card-desc" data-dev-mailbox-desc></p>' +
    '<a class="ef-btn ef-btn-primary ef-btn-sm ef-mt-12" href="#" data-dev-mailbox-link>' + escapeHtml(c.openSecureLink) + '</a>' +
    '</div>';
}

export function getAuthCopy(locale = "en") {
  return COPY[locale] || COPY.en;
}

export function renderAuthPage(type, t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, oauthDetails = {}) {
  const c = getAuthCopy(locale);
  const configStatus = '<p class="ef-form-banner" data-auth-config-status role="status" aria-live="polite">' + escapeHtml(c.checking) + '</p>';

  if (type === "auth-oauth-consent") {
    const requestedScopes = Array.isArray(oauthDetails.scopes) ? oauthDetails.scopes : [];
    const descriptions = locale === "ar"
      ? {
          "openid": "تأكيد هوية حسابك.",
          "profile": "مشاركة بيانات ملفك الشخصي الأساسية.",
          "email": "مشاركة بريدك الإلكتروني المؤكد.",
          "offline_access": "السماح للاتصال بتجديد الوصول أثناء نشاطه.",
          "tasks:fetch": "جلب صفحات الويب العامة وإرجاع أدلة المصدر.",
          "tasks:map": "اكتشاف روابط النطاق ضمن حدود مضبوطة.",
          "tasks:crawl": "زحف عدد محدود من الصفحات العامة.",
          "tasks:extract": "استخراج حقول محددة من الصفحات العامة.",
        }
      : {
          "openid": "Confirm your account identity.",
          "profile": "Share your basic profile information.",
          "email": "Share your verified email address.",
          "offline_access": "Allow the connection to refresh access while the link remains active.",
          "tasks:fetch": "Fetch public web pages and return source evidence.",
          "tasks:map": "Discover bounded same-origin pages on a website.",
          "tasks:crawl": "Crawl a small number of public pages.",
          "tasks:extract": "Extract explicitly requested fields from public pages.",
        };
    const scopeRows = requestedScopes.map(function (scope) {
      return '<li class="ef-session-row"><div><strong>' + escapeHtml(scope) + '</strong><p>' +
        escapeHtml(descriptions[scope] || scope) + '</p></div></li>';
    }).join("");
    const content =
      '<div class="ef-account-stack">' +
        '<p class="ef-acc-card-desc">' + escapeHtml(c.oauthConsentDesc) + '</p>' +
        '<p><strong>' + escapeHtml(c.clientIdLabel) + '</strong><br><code dir="ltr">' + escapeHtml(oauthDetails.clientId || c.unknownApp) + '</code></p>' +
        '<h2>' + escapeHtml(c.requestedPermissions) + '</h2>' +
        '<ul class="ef-session-list">' + scopeRows + '</ul>' +
        '<p class="ef-acc-card-desc">' + escapeHtml(c.oauthConsentNote) + '</p>' +
        '<div class="ef-hero-actions">' +
          '<button type="button" class="ef-btn ef-btn-primary" data-oauth-consent-accept>' + escapeHtml(c.authorizeBtn) + '</button>' +
          '<button type="button" class="ef-btn ef-btn-secondary" data-oauth-consent-deny>' + escapeHtml(c.cancelBtn) + '</button>' +
        '</div>' +
        '<p class="ef-form-banner" data-oauth-flow-status role="status" aria-live="polite"></p>' +
      '</div>';
    return authFrame(escapeHtml(c.oauthConsentKicker), escapeHtml(c.oauthConsentTitle), escapeHtml(c.oauthConsentLead), content);
  }

  if (type === "auth-oauth-select-tenant") {
    const content =
      '<form class="ef-auth-form" data-oauth-tenant-form>' +
        '<div class="ef-field"><label for="oauth-tenant-choice">' + escapeHtml(c.workspaceLabel) + '</label>' +
          '<select id="oauth-tenant-choice" name="tenantId" required><option value="">' + escapeHtml(c.loadingWorkspaces) + '</option></select>' +
        '</div>' +
        '<p class="ef-acc-card-desc">' + escapeHtml(c.oauthSelectNote) + '</p>' +
        '<button type="submit" class="ef-btn ef-btn-primary ef-btn-full" disabled data-oauth-tenant-submit>' + escapeHtml(c.continueBtn) + '</button>' +
        '<p class="ef-form-banner" data-oauth-flow-status role="status" aria-live="polite"></p>' +
      '</form>';
    return authFrame(escapeHtml(c.oauthSelectKicker), escapeHtml(c.oauthSelectTitle), escapeHtml(c.oauthSelectLead), content);
  }

  if (type === "auth-signin") {
    const fields = [
      field("auth-email", "email", c.email, "email", "email", "name@example.com", escapeHtml),
      field("auth-password", "password", c.password, "password", "current-password", "", escapeHtml, { showPasswordLabel: c.showPassword }),
    ];
    const metaRow =
      '<div class="ef-auth-meta-row">' +
        '<label class="ef-consent"><input type="checkbox" name="rememberMe" checked><span>' + escapeHtml(c.rememberDevice) + '</span></label>' +
        '<a class="ef-auth-inline-link" href="' + hrefFor("/forgot-password", locale) + '">' + escapeHtml(c.forgotPasswordLink) + '</a>' +
      '</div>';
    const form = emailForm("signin", c.signIn, fields, c.signIn, escapeHtml, metaRow);
    const resendVerify =
      '<div class="ef-auth-resend" data-resend-verify-wrap hidden>' +
        '<p class="ef-acc-card-desc">' + escapeHtml(c.resendVerifyPrompt) + '</p>' +
        '<button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-resend-verify-btn>' + escapeHtml(c.resendVerifyBtn) + '</button>' +
      '</div>';
    const content =
      googleAction(c.google, "signin") +
      '<div class="ef-auth-divider" data-auth-google-divider hidden><span>' + escapeHtml(c.orEmail) + '</span></div>' +
      form +
      resendVerify +
      devMailboxBox(c, escapeHtml) +
      '<p class="ef-auth-switch">' + escapeHtml(c.newToExportFlow) + ' <a href="' + hrefFor("/signup", locale) + '" data-auth-preserve-next>' + escapeHtml(c.create) + '</a></p>' +
      configStatus;
    return authFrame(escapeHtml(c.signInKicker), escapeHtml(c.signInTitle), escapeHtml(c.signInLead), content);
  }

  if (type === "auth-signup") {
    const fields = [
      field("signup-name", "name", c.name, "text", "name", "", escapeHtml),
      field("signup-email", "email", c.email, "email", "email", "name@example.com", escapeHtml),
      field("signup-password", "password", c.password, "password", "new-password", "", escapeHtml, { showPasswordLabel: c.showPassword, withStrength: true, copy: c, minlength: 8 }),
    ];
    const form = emailForm("signup", c.create, fields, c.create, escapeHtml);
    const content = googleAction(c.google, "signup") +
      '<div class="ef-auth-divider" data-auth-google-divider hidden><span>' + escapeHtml(c.orEmail) + '</span></div>' +
      form +
      devMailboxBox(c, escapeHtml) +
      '<p class="ef-auth-switch">' + escapeHtml(c.alreadyHaveAccount) + ' <a href="' + hrefFor("/signin", locale) + '" data-auth-preserve-next>' + escapeHtml(c.signIn) + '</a></p>' +
      configStatus;
    return authFrame(escapeHtml(c.signUpKicker), escapeHtml(c.signUpTitle), escapeHtml(c.signUpLead), content);
  }

  if (type === "auth-forgot") {
    const fields = [field("forgot-email", "email", c.email, "email", "email", "name@example.com", escapeHtml)];
    const form = emailForm("forgot", c.sendReset, fields, c.sendReset, escapeHtml);
    const content = form +
      devMailboxBox(c, escapeHtml) +
      '<p class="ef-form-banner" data-auth-email-disabled hidden>' + escapeHtml(c.emailOnly) + '</p>' +
      '<p class="ef-auth-switch"><a href="' + hrefFor("/signin", locale) + '">' + escapeHtml(c.backToSignIn) + '</a></p>' +
      configStatus;
    return authFrame(escapeHtml(c.forgotKicker), escapeHtml(c.forgotTitle), escapeHtml(c.forgotLead), content);
  }

  if (type === "auth-reset") {
    const fields = [
      field("reset-password", "password", c.newPassword, "password", "new-password", "", escapeHtml, { showPasswordLabel: c.showPassword, withStrength: true, copy: c, minlength: 8 }),
      field("reset-password-confirm", "confirmPassword", c.confirmPassword, "password", "new-password", "", escapeHtml, { showPasswordLabel: c.showPassword, minlength: 8 }),
    ];
    const form = emailForm("reset", c.savePassword, fields, c.savePassword, escapeHtml);
    const content = form +
      '<p class="ef-form-banner" data-auth-reset-disabled hidden>' + escapeHtml(c.accountUnavailable) + '</p>' +
      '<p class="ef-auth-switch"><a href="' + hrefFor("/signin", locale) + '">' + escapeHtml(c.backToSignIn) + '</a></p>' +
      configStatus;
    return authFrame(escapeHtml(c.resetKicker), escapeHtml(c.resetTitle), escapeHtml(c.resetLead), content);
  }

  if (type === "auth-workspace") {
    const content =
      '<div data-workspace-loading class="ef-form-banner" role="status">' + escapeHtml(c.loading) + '</div>' +
      '<div data-workspace-shell hidden>' +
        '<div class="ef-account-hero-row ef-workspace-bar">' +
          '<div class="ef-account-identity">' +
            '<div class="ef-avatar-circle ef-avatar-lg" data-account-avatar aria-hidden="true">EF</div>' +
            '<div>' +
              '<h2 class="ef-workspace-user-name" data-account-display-name>' + escapeHtml(c.workspaceMember) + '</h2>' +
              '<p class="ef-acc-email-line"><span data-account-email-text></span><span class="ef-badge ef-badge-available" data-account-email-badge>' + escapeHtml(c.verifiedBadge) + '</span></p>' +
            '</div>' +
          '</div>' +
          '<div class="ef-account-hero-actions">' +
            '<a class="ef-btn ef-btn-secondary ef-btn-sm" href="' + hrefFor("/account", locale) + '">' + escapeHtml(c.openAccount) + '</a>' +
            '<button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-auth-signout>' + escapeHtml(c.signOut) + '</button>' +
          '</div>' +
        '</div>' +

        '<div class="ef-workspace-stats">' +
          '<div class="ef-stat-card"><span>' + escapeHtml(c.statKeys) + '</span><strong data-ws-stat-keys>0</strong></div>' +
          '<div class="ef-stat-card"><span>' + escapeHtml(c.statRuns) + '</span><strong data-ws-stat-runs>0</strong></div>' +
          '<div class="ef-stat-card"><span>' + escapeHtml(c.statMaxCap) + '</span><strong dir="ltr">1 MiB / 8 sec</strong></div>' +
          '<div class="ef-stat-card"><span>' + escapeHtml(c.statAdapter) + '</span><strong dir="ltr">http.fetch.v1</strong></div>' +
        '</div>' +

        '<div class="ef-account-grid ef-mt-20">' +
          '<div class="ef-account-col">' +
            '<article class="ef-account-card">' +
              '<div class="ef-account-card-head"><div><h2>' + escapeHtml(c.execTitle) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.execDesc) + '</p></div><span class="ef-badge ef-badge-available"><span>http.fetch.v1</span></span></div>' +
              '<form class="ef-auth-form" data-ws-exec-form>' +
                '<div class="ef-field"><label for="ws-goal">' + escapeHtml(c.execGoal) + '</label><input id="ws-goal" name="goal" required maxlength="2000" value="' + escapeHtml(c.execDefaultGoal) + '"></div>' +
                '<div class="ef-field"><label for="ws-url">' + escapeHtml(c.execUrl) + '</label><input id="ws-url" name="url" type="url" class="ef-ltr-input" required value="https://example.com/"></div>' +
                '<div class="ef-field-row">' +
                  '<div class="ef-field"><label for="ws-mode">' + escapeHtml(c.execMode) + '</label><select id="ws-mode" name="mode"><option value="live">' + escapeHtml(c.execModeLive) + '</option><option value="simulate">' + escapeHtml(c.execModeSim) + '</option></select></div>' +
                  '<div class="ef-field"><label for="ws-redirects">' + escapeHtml(c.maxRedirectsLabel) + '</label><input id="ws-redirects" name="maxRedirects" type="number" min="0" max="3" value="2"></div>' +
                '</div>' +
                '<div class="ef-field-row">' +
                  '<div class="ef-field"><label for="ws-timeout">' + escapeHtml(c.timeoutLabel) + '</label><input id="ws-timeout" name="timeoutMs" type="number" min="100" max="8000" value="5000"></div>' +
                  '<div class="ef-field"><label for="ws-bytes">' + escapeHtml(c.maxBytesLabel) + '</label><input id="ws-bytes" name="maxBytes" type="number" min="64" max="1048576" value="131072"></div>' +
                '</div>' +
                '<button type="submit" class="ef-btn ef-btn-primary ef-btn-sm">' + escapeHtml(c.execRun) + '</button>' +
                '<p class="ef-form-banner" data-ws-exec-status role="status" aria-live="polite"></p>' +
              '</form>' +
            '</article>' +

            '<article class="ef-account-card">' +
              '<div class="ef-account-card-head"><div><h2>' + escapeHtml(c.keysTitle) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.keysDesc) + '</p></div></div>' +
              '<form class="ef-auth-form" data-ws-key-form>' +
                '<div class="ef-field"><label for="ws-key-name">' + escapeHtml(c.keyNameLabel) + '</label><input id="ws-key-name" name="name" required minlength="2" maxlength="60" placeholder="' + escapeHtml(c.keyNamePlaceholder) + '"></div>' +
                '<button type="submit" class="ef-btn ef-btn-secondary ef-btn-sm">' + escapeHtml(c.keyCreateBtn) + '</button>' +
                '<p class="ef-form-banner" data-ws-key-status role="status" aria-live="polite"></p>' +
              '</form>' +
              '<div class="ef-dev-mailbox ef-mt-12" data-ws-key-reveal hidden>' +
                '<div class="ef-dev-mailbox-head"><span class="ef-badge ef-badge-available"><span>' + escapeHtml(c.createdOnce) + '</span></span><strong>' + escapeHtml(c.copyNewKey) + '</strong></div>' +
                '<code class="ef-key-secret-code" data-ws-key-secret></code>' +
                '<button type="button" class="ef-code-btn ef-mt-12" data-ws-key-copy>' + escapeHtml(c.copyKeyBtn) + '</button>' +
              '</div>' +
              '<ul class="ef-session-list ef-mt-20" data-ws-key-list aria-live="polite"></ul>' +
            '</article>' +
          '</div>' +

          '<div class="ef-account-col">' +
            '<article class="ef-account-card">' +
              '<div class="ef-account-card-head"><div><h2>' + escapeHtml(c.execOutput) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.execOutputDesc) + '</p></div><span class="ef-code-caption" data-ws-http-badge>' + escapeHtml(c.idleBadge) + '</span></div>' +
              '<div class="ef-code-card">' +
                '<div class="ef-code-head"><span class="ef-code-caption">' + escapeHtml(c.jsonResponse) + '</span><button type="button" class="ef-code-btn" data-copy-source="ws-exec-pre"><span data-copy-label>' + escapeHtml(c.copyBtn) + '</span></button></div>' +
                '<pre class="ef-code-pre ef-demo-pre"><code id="ws-exec-pre" data-ws-exec-output>' + escapeHtml(c.idleOutputHint) + '</code></pre>' +
              '</div>' +
            '</article>' +

            '<article class="ef-account-card">' +
              '<div class="ef-account-card-head"><div><h2>' + escapeHtml(c.historyTitle) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.historyDesc) + '</p></div><button type="button" class="ef-code-btn" data-ws-history-clear>' + escapeHtml(c.historyClear) + '</button></div>' +
              '<ul class="ef-session-list" data-ws-history-list aria-live="polite"></ul>' +
            '</article>' +
          '</div>' +
        '</div>' +
      '</div>';

    return authFrame(escapeHtml(c.workspaceKicker), escapeHtml(c.workspaceTitle), escapeHtml(c.workspaceLead), content, true);
  }

  const content = '<div data-account-loading class="ef-form-banner" role="status">' + escapeHtml(c.loading) + '</div>' +
    '<div class="ef-account-workspace" data-account-workspace hidden>' +
      '<nav class="ef-account-settings-nav" aria-label="' + escapeHtml(c.accountTitle) + '" data-account-settings-nav>' +
        '<a href="#account-profile" data-account-section-link aria-current="location">' + escapeHtml(c.profile) + '</a>' +
        '<a href="#account-connected" data-account-section-link>' + escapeHtml(c.connected) + '</a>' +
        '<a href="#account-security" data-account-section-link>' + escapeHtml(c.security) + '</a>' +
        '<a href="#account-sessions" data-account-section-link>' + escapeHtml(c.sessions) + '</a>' +
      '</nav>' +
      '<div class="ef-account-hero-row ef-workspace-bar ef-mb-20">' +
        '<div class="ef-account-identity">' +
          '<div class="ef-avatar-circle ef-avatar-lg" data-account-avatar aria-hidden="true">EF</div>' +
          '<div>' +
            '<h2 class="ef-workspace-user-name" data-account-display-name>' + escapeHtml(c.accountMember) + '</h2>' +
            '<p class="ef-acc-email-line"><span data-account-email-text></span><span class="ef-badge ef-badge-available" data-account-email-badge>' + escapeHtml(c.verifiedBadge) + '</span></p>' +
          '</div>' +
        '</div>' +
        '<div class="ef-account-hero-actions">' +
          '<a class="ef-btn ef-btn-primary ef-btn-sm" href="' + hrefFor("/workspace", locale) + '">' + escapeHtml(c.openWorkspace) + '</a>' +
          '<button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-auth-signout>' + escapeHtml(c.signOut) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="ef-account-grid">' +
        '<div class="ef-account-col">' +
          '<article id="account-profile" class="ef-account-card" tabindex="-1">' +
            '<div class="ef-account-card-head"><div><h2>' + escapeHtml(c.profile) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.profileDesc) + '</p></div></div>' +
            '<form class="ef-auth-form" data-account-profile-form>' +
              '<div class="ef-field"><label for="acc-name">' + escapeHtml(c.name) + '</label><input id="acc-name" name="name" maxlength="100" required></div>' +
              '<div class="ef-field"><label for="acc-email">' + escapeHtml(c.email) + '</label><input id="acc-email" class="ef-ltr-input" name="email" type="email" readonly aria-readonly="true"></div>' +
              '<div class="ef-profile-actions"><button type="submit" class="ef-btn ef-btn-primary ef-btn-sm">' + escapeHtml(c.save) + '</button>' +
              '<button type="reset" class="ef-btn ef-btn-secondary ef-btn-sm" data-profile-reset hidden>' + escapeHtml(c.cancel) + '</button></div>' +
              '<p class="ef-profile-unsaved" data-profile-unsaved role="status" aria-live="polite" hidden></p>' +
              '<p class="ef-form-banner" data-profile-status role="status" aria-live="polite"></p>' +
            '</form>' +
          '</article>' +
          '<article id="account-sessions" class="ef-account-card" tabindex="-1"><div class="ef-account-card-head"><div><h2>' + escapeHtml(c.sessions) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.sessionsDesc) + '</p></div></div>' +
            '<div class="ef-account-stack">' +
              '<ul class="ef-session-list" data-auth-session-list aria-live="polite"></ul>' +
              '<p class="ef-form-banner" data-auth-session-status data-session-stale-message="' + escapeHtml(c.sessionReauth) + '" data-session-error-message="' + escapeHtml(c.sessionUnavailable) + '" data-session-reauth-href="' + hrefFor("/signin", locale) + '" data-session-reauth-label="' + escapeHtml(c.signIn) + '" role="status" aria-live="polite" hidden></p>' +
              '<div><button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-auth-revoke-all>' + escapeHtml(c.revokeAll) + '</button></div>' +
            '</div>' +
          '</article>' +
        '</div>' +
        '<div class="ef-account-col">' +
          '<article id="account-connected" class="ef-account-card" tabindex="-1"><div class="ef-account-card-head"><div><h2>' + escapeHtml(c.connected) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.connectedDesc) + '</p></div></div>' +
            '<div class="ef-account-stack">' +
              '<ul class="ef-session-list" data-auth-account-list aria-live="polite"></ul>' +
              '<div><button type="button" class="ef-google-btn ef-google-btn-sm" data-auth-link-google disabled hidden>' + googleMark() + '<span>' + escapeHtml(c.linkGoogle) + '</span></button></div>' +
            '</div>' +
          '</article>' +
          '<article id="account-security" class="ef-account-card" tabindex="-1"><div class="ef-account-card-head"><div><h2>' + escapeHtml(c.security) + '</h2><p class="ef-acc-card-desc">' + escapeHtml(c.securityDesc) + '</p></div></div>' +
            '<div class="ef-account-stack">' +
              '<section data-account-two-factor>' +
                '<p class="ef-form-banner" data-two-factor-status role="status" aria-live="polite">' + escapeHtml(c.totpChecking) + '</p>' +
                '<form class="ef-auth-form ef-mt-12" data-two-factor-enable-form hidden>' +
                  field("acc-totp-password", "password", c.totpPasswordLabel, "password", "current-password", "", escapeHtml, { showPasswordLabel: c.showPassword }) +
                  '<p class="ef-acc-card-desc">' + escapeHtml(c.totpSetupDesc) + '</p>' +
                  '<button type="submit" class="ef-btn ef-btn-secondary ef-btn-sm">' + escapeHtml(c.totpSetupBtn) + '</button>' +
                  '<p class="ef-form-banner" data-two-factor-enable-message role="status" aria-live="polite"></p>' +
                '</form>' +
                '<div class="ef-account-stack ef-mt-12" data-two-factor-enrollment hidden>' +
                  '<p class="ef-acc-card-desc">' + escapeHtml(c.totpVerifyDesc) + '</p>' +
                  '<div><p><strong>' + escapeHtml(c.totpKeyTitle) + '</strong></p><code data-two-factor-secret></code></div>' +
                  '<div><button type="button" class="ef-code-btn" data-two-factor-copy-secret>' + escapeHtml(c.totpCopyKey) + '</button></div>' +
                  '<ul class="ef-session-list" data-two-factor-backup-codes aria-label="' + escapeHtml(c.backupCodesLabel) + '"></ul>' +
                  '<form class="ef-auth-form" data-two-factor-verify-form>' +
                    '<div class="ef-field"><label for="acc-totp-code">' + escapeHtml(c.totpCodeLabel) + '</label><input id="acc-totp-code" class="ef-ltr-input" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></div>' +
                    '<button type="submit" class="ef-btn ef-btn-primary ef-btn-sm">' + escapeHtml(c.totpVerifyBtn) + '</button>' +
                    '<p class="ef-form-banner" data-two-factor-verify-message role="status" aria-live="polite"></p>' +
                  '</form>' +
                '</div>' +
              '</section>' +
              '<form class="ef-auth-form" data-account-password-form hidden>' +
                '<h3 class="ef-account-subhead">' + escapeHtml(c.changePasswordHeading) + '</h3>' +
                field("acc-current-password", "currentPassword", c.currentPassword, "password", "current-password", "", escapeHtml, { showPasswordLabel: c.showPassword }) +
                field("acc-new-password", "newPassword", c.newPassword, "password", "new-password", "", escapeHtml, { showPasswordLabel: c.showPassword, withStrength: true, copy: c, minlength: 8 }) +
                field("acc-confirm-password", "confirmPassword", c.confirmPassword, "password", "new-password", "", escapeHtml, { showPasswordLabel: c.showPassword, minlength: 8 }) +
                '<button type="submit" class="ef-btn ef-btn-secondary ef-btn-sm">' + escapeHtml(c.changePasswordBtn) + '</button>' +
                '<p class="ef-form-banner" data-password-change-status role="status" aria-live="polite"></p>' +
              '</form>' +
            '</div>' +
          '</article>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<p class="ef-form-banner" data-auth-account-status role="status" aria-live="polite"></p>' +
    configStatus;

  return authFrame(escapeHtml(c.accountKicker), escapeHtml(c.accountTitle), escapeHtml(c.accountLead), content, true);
}
