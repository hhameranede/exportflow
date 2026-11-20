export const AUTH_ROUTES = [
  ["/signin", "Sign in", "Sign in to your ExportFlow workspace.", "auth-signin"],
  ["/signup", "Create account", "Create your ExportFlow developer account.", "auth-signup"],
  ["/forgot-password", "Reset password", "Request a secure password reset link.", "auth-forgot"],
  ["/reset-password", "Choose a new password", "Set a new password for your ExportFlow account.", "auth-reset"],
  ["/account", "Account", "Manage your ExportFlow profile, connected accounts, and sessions.", "auth-account"],
];

const COPY = {
  en: {
    signInTitle: "Sign in to ExportFlow",
    signInLead: "Continue to your developer workspace and manage your projects securely.",
    signUpTitle: "Create your account",
    signUpLead: "Create one secure identity for your ExportFlow workspace.",
    forgotTitle: "Reset your password",
    forgotLead: "We will send a secure reset link if email sign-in is enabled.",
    resetTitle: "Choose a new password",
    accountTitle: "Your account",
    accountLead: "Manage your personal details, connected identity providers, and active sessions.",
    google: "Continue with Google",
    checking: "Checking account services…",
    unavailable: "Account services are not configured yet. Google sign-in will be enabled when the server credentials and database are connected.",
    emailDisabled: "Email and password sign-in are not enabled yet. Use Google when it becomes available.",
    name: "Full name",
    email: "Email address",
    password: "Password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    create: "Create account",
    signIn: "Sign in",
    sendReset: "Send reset link",
    save: "Save changes",
    signOut: "Sign out",
    profile: "Profile",
    connected: "Connected accounts",
    sessions: "Active sessions",
    revokeAll: "Sign out other sessions",
    sessionReauth: "Your session needs a fresh sign-in before you can view or manage other sessions.",
    sessionUnavailable: "Sessions could not be loaded right now. Your profile and connected accounts are still available.",
    loading: "Loading your account…",
    profileUpdated: "Profile updated.",
    verifyEmail: "Check your inbox for a verification link to finish creating your account.",
    resetSent: "If this email is registered, a password reset link will be sent.",
    accountDisabled: "Your account could not be loaded. Sign in again.",
    noSessions: "No other active sessions were found.",
    noAccounts: "No linked social accounts.",
    linkGoogle: "Connect Google",
    unlinkGoogle: "Disconnect",
    currentSession: "Current session",
    revoke: "Revoke",
    passwordMismatch: "Passwords do not match.",
    minimumPassword: "Use at least 8 characters.",
    emailOnly: "Email/password is disabled until secure email delivery is configured.",
    accountUnavailable: "The account service is temporarily unavailable.",
  },
  ar: {
    signInTitle: "تسجيل الدخول إلى ExportFlow",
    signInLead: "واصل إلى مساحة المطور الخاصة بك بأمان.",
    signUpTitle: "إنشاء حساب جديد",
    signUpLead: "أنشئ هوية واحدة آمنة لمساحة عملك في ExportFlow.",
    forgotTitle: "استعادة كلمة المرور",
    forgotLead: "سنرسل رابط استعادة آمن إذا كان تسجيل الدخول بالبريد مفعّلاً.",
    resetTitle: "اختيار كلمة مرور جديدة",
    accountTitle: "حسابك",
    accountLead: "أدر معلوماتك الشخصية والحسابات المرتبطة والجلسات النشطة.",
    google: "المتابعة باستخدام Google",
    checking: "جارٍ التحقق من خدمات الحساب…",
    unavailable: "خدمات الحساب غير مهيأة بعد. سيتفعّل Google بعد ربط بيانات الخادم وقاعدة البيانات.",
    emailDisabled: "الدخول بالبريد وكلمة المرور غير مفعّل حالياً. استعمل Google عندما يصبح متاحاً.",
    name: "الاسم الكامل",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    newPassword: "كلمة مرور جديدة",
    confirmPassword: "تأكيد كلمة المرور",
    create: "إنشاء الحساب",
    signIn: "تسجيل الدخول",
    sendReset: "إرسال رابط الاستعادة",
    save: "حفظ التغييرات",
    signOut: "تسجيل الخروج",
    profile: "الملف الشخصي",
    connected: "الحسابات المرتبطة",
    sessions: "الجلسات النشطة",
    revokeAll: "إنهاء الجلسات الأخرى",
    sessionReauth: "يلزم تسجيل الدخول مجدداً للتحقق من الجلسات الأخرى وإدارتها.",
    sessionUnavailable: "تعذر تحميل الجلسات حالياً، لكن يبقى ملفك الشخصي وحساباتك المرتبطة متاحة.",
    loading: "جارٍ تحميل حسابك…",
    profileUpdated: "تم تحديث الملف الشخصي.",
    verifyEmail: "تحقق من بريدك الإلكتروني وافتح رابط التفعيل لإكمال إنشاء الحساب.",
    resetSent: "إذا كان البريد مسجلاً، فسيتم إرسال رابط استعادة كلمة المرور.",
    accountDisabled: "تعذر تحميل حسابك. سجّل الدخول مجدداً.",
    noSessions: "لم يتم العثور على جلسات نشطة أخرى.",
    noAccounts: "لا توجد حسابات اجتماعية مرتبطة.",
    linkGoogle: "ربط Google",
    unlinkGoogle: "إلغاء الربط",
    currentSession: "الجلسة الحالية",
    revoke: "إنهاء",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    minimumPassword: "استعمل 8 أحرف على الأقل.",
    emailOnly: "الدخول بالبريد متوقف حتى نجهز إرسال الرسائل بشكل آمن.",
    accountUnavailable: "خدمة الحساب غير متاحة مؤقتاً.",
  },
};

function googleMark() {
  return '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7.3 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.4 28.6a14.5 14.5 0 0 1 0-9.2l-7.8-6.1a24 24 0 0 0 0 21.4z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.7l-7.3-5.7c-2 1.3-4.6 2.1-8.7 2.1-6.3 0-11.7-4.2-13.6-10.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
}

function field(id, name, label, type, autocomplete, placeholder, escapeHtml) {
  return '<div class="ef-field"><label for="' + id + '">' + escapeHtml(label) + '</label>' +
    '<input id="' + id + '" name="' + name + '" type="' + type + '" autocomplete="' + autocomplete + '"' +
    (placeholder ? ' placeholder="' + escapeHtml(placeholder) + '"' : "") + ' required>' +
    '<span class="ef-field-error" data-auth-field-error="' + name + '" role="alert"></span></div>';
}

function authFrame(eyebrow, title, lead, content) {
  return '<section class="ef-auth-section" data-auth-page>' +
    '<div class="ef-container ef-auth-single-wrap"><div class="ef-auth-card">' +
    '<p class="ef-eyebrow">' + eyebrow + '</p>' +
    '<h1 class="ef-auth-card-title">' + title + '</h1>' +
    '<p class="ef-auth-card-lead">' + lead + '</p>' +
    content +
    '</div></div></section>';
}

function googleAction(label, mode) {
  return '<button type="button" class="ef-google-btn" data-auth-google data-auth-google-mode="' + mode + '" disabled>' +
    googleMark() + '<span>' + label + '</span></button>';
}

function emailForm(mode, label, fields, buttonLabel, escapeHtml) {
  return '<form class="ef-auth-form" data-auth-form="' + mode + '" hidden>' +
    fields.join("") +
    '<button type="submit" class="ef-btn ef-btn-primary ef-btn-full"><span>' + escapeHtml(buttonLabel) + '</span></button>' +
    '<p class="ef-form-banner" data-auth-form-status role="status" aria-live="polite"></p>' +
    '</form>';
}

export function getAuthCopy(locale = "en") {
  return COPY[locale] || COPY.en;
}

export function renderAuthPage(type, t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon) {
  const c = getAuthCopy(locale);
  const configStatus = '<p class="ef-form-banner" data-auth-config-status role="status" aria-live="polite">' + escapeHtml(c.checking) + '</p>';

  if (type === "auth-signin") {
    const fields = [
      field("auth-email", "email", c.email, "email", "email", "name@example.com", escapeHtml),
      field("auth-password", "password", c.password, "password", "current-password", "", escapeHtml),
    ];
    const form = emailForm("signin", c.signIn, fields, c.signIn, escapeHtml);
    const content = '<div class="ef-auth-card-head"><span class="ef-badge ef-badge-dev">Secure account access</span></div>' +
      googleAction(c.google, "signin") +
      '<div class="ef-auth-divider"><span>or use email</span></div>' + form +
      '<p class="ef-auth-switch"><a href="' + hrefFor("/forgot-password", locale) + '">Forgot password?</a></p>' +
      '<p class="ef-auth-switch">New to ExportFlow? <a href="' + hrefFor("/signup", locale) + '">Create an account</a></p>' +
      configStatus;
    return authFrame("ACCOUNT ACCESS", c.signInTitle, c.signInLead, content);
  }

  if (type === "auth-signup") {
    const fields = [
      field("signup-name", "name", c.name, "text", "name", "", escapeHtml),
      field("signup-email", "email", c.email, "email", "email", "name@example.com", escapeHtml),
      field("signup-password", "password", c.password, "password", "new-password", "", escapeHtml),
    ];
    const form = emailForm("signup", c.create, fields, c.create, escapeHtml);
    const content = googleAction(c.google, "signup") +
      '<div class="ef-auth-divider"><span>or use email</span></div>' + form +
      '<p class="ef-auth-switch">Already have an account? <a href="' + hrefFor("/signin", locale) + '">' + escapeHtml(c.signIn) + '</a></p>' +
      configStatus;
    return authFrame("DEVELOPER ONBOARDING", c.signUpTitle, c.signUpLead, content);
  }

  if (type === "auth-forgot") {
    const fields = [field("forgot-email", "email", c.email, "email", "email", "name@example.com", escapeHtml)];
    const form = emailForm("forgot", c.sendReset, fields, c.sendReset, escapeHtml);
    const content = form +
      '<p class="ef-form-banner" data-auth-email-disabled hidden>' + escapeHtml(c.emailOnly) + '</p>' +
      '<p class="ef-auth-switch"><a href="' + hrefFor("/signin", locale) + '">' + escapeHtml(c.signIn) + '</a></p>' +
      configStatus;
    return authFrame("ACCOUNT RECOVERY", c.forgotTitle, c.forgotLead, content);
  }

  if (type === "auth-reset") {
    const fields = [
      field("reset-password", "password", c.newPassword, "password", "new-password", "", escapeHtml),
      field("reset-password-confirm", "confirmPassword", c.confirmPassword, "password", "new-password", "", escapeHtml),
    ];
    const form = emailForm("reset", "Save password", fields, "Save password", escapeHtml);
    const content = form +
      '<p class="ef-form-banner" data-auth-reset-disabled hidden>' + escapeHtml(c.accountUnavailable) + '</p>' +
      configStatus;
    return authFrame("ACCOUNT SECURITY", c.resetTitle, c.forgotLead, content);
  }

  const content = '<div data-account-loading class="ef-form-banner" role="status">' + escapeHtml(c.loading) + '</div>' +
    '<div data-account-workspace hidden>' +
    '<div class="ef-account-grid">' +
      '<div class="ef-account-col">' +
        '<article class="ef-account-card">' +
          '<div class="ef-account-card-head"><div><h2>' + escapeHtml(c.profile) + '</h2><p class="ef-acc-card-desc">Your verified account details.</p></div></div>' +
          '<form class="ef-auth-form" data-account-profile-form>' +
            '<div class="ef-field"><label for="acc-name">' + escapeHtml(c.name) + '</label><input id="acc-name" name="name" maxlength="100" required></div>' +
            '<div class="ef-field"><label for="acc-email">' + escapeHtml(c.email) + '</label><input id="acc-email" name="email" type="email" readonly aria-readonly="true"></div>' +
            '<button type="submit" class="ef-btn ef-btn-primary ef-btn-sm">' + escapeHtml(c.save) + '</button>' +
            '<p class="ef-form-banner" data-profile-status role="status" aria-live="polite"></p>' +
          '</form>' +
        '</article>' +
        '<article class="ef-account-card"><div class="ef-account-card-head"><div><h2>' + escapeHtml(c.sessions) + '</h2><p class="ef-acc-card-desc">Review and revoke sessions connected to your account.</p></div></div>' +
          '<ul class="ef-session-list" data-auth-session-list aria-live="polite"></ul>' +
          '<p class="ef-form-banner" data-auth-session-status data-session-stale-message="' + escapeHtml(c.sessionReauth) + '" data-session-error-message="' + escapeHtml(c.sessionUnavailable) + '" data-session-reauth-href="' + hrefFor("/signin", locale) + '" data-session-reauth-label="' + escapeHtml(c.signIn) + '" role="status" aria-live="polite" hidden></p>' +
          '<button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-auth-revoke-all>' + escapeHtml(c.revokeAll) + '</button>' +
        '</article>' +
      '</div>' +
      '<div class="ef-account-col">' +
        '<article class="ef-account-card"><div class="ef-account-card-head"><div><h2>' + escapeHtml(c.connected) + '</h2><p class="ef-acc-card-desc">Manage providers that can authenticate to this account.</p></div></div>' +
          '<ul class="ef-session-list" data-auth-account-list aria-live="polite"></ul>' +
          '<button type="button" class="ef-google-btn ef-google-btn-sm" data-auth-link-google disabled>' + googleMark() + '<span>' + escapeHtml(c.linkGoogle) + '</span></button>' +
        '</article>' +
        '<article class="ef-account-card"><div class="ef-account-card-head"><div><h2>Security</h2><p class="ef-acc-card-desc">Change your password when email sign-in is enabled, and sign out securely.</p></div></div>' +
          '<form class="ef-auth-form" data-account-password-form hidden>' +
            '<div class="ef-field"><label for="acc-current-password">Current password</label><input id="acc-current-password" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
            '<div class="ef-field"><label for="acc-new-password">New password</label><input id="acc-new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" required></div>' +
            '<div class="ef-field"><label for="acc-confirm-password">Confirm new password</label><input id="acc-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div>' +
            '<button type="submit" class="ef-btn ef-btn-secondary ef-btn-sm">Change password</button>' +
            '<p class="ef-form-banner" data-password-change-status role="status" aria-live="polite"></p>' +
          '</form>' +
          '<button type="button" class="ef-btn ef-btn-secondary ef-btn-sm" data-auth-signout>' + escapeHtml(c.signOut) + '</button>' +
        '</article>' +
      '</div>' +
    '</div></div>' +
    '<p class="ef-form-banner" data-auth-account-status role="status" aria-live="polite"></p>' +
    configStatus;
  return authFrame("WORKSPACE IDENTITY", c.accountTitle, c.accountLead, content);
}
