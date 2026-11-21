import { renderDocument, escapeHtml } from "./layout.js";
import { SITE_META } from "./data.js";
import { renderExecutionGraph } from "./execution-graph.js";
import { AUTH_ROUTES, renderAuthPage, getAuthCopy } from "./auth-pages.js";

const LANGUAGES = ["en", "ar", "fr", "es", "de", "pt", "zh", "ja"];

const LANGUAGE_LABELS = [
  ["en", "English"],
  ["ar", "العربية"],
  ["fr", "Français"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["zh", "中文"],
  ["ja", "日本語"],
];

const COPY = {
  en: { product: "Product", solutions: "Solutions", developers: "Developers", pricing: "Pricing", resources: "Resources", about: "About", contact: "Contact", signIn: "Sign in", start: "Get started", eyebrow: "AGENT EXECUTION INFRASTRUCTURE", hero: "Give AI the Power to Execute.", lead: "From web intelligence to browser automation, ExportFlow provides the execution infrastructure that helps AI agents turn complex plans into verifiable results.", explore: "Explore the platform", available: "Available locally", development: "In development", planned: "Planned", capabilities: "Execution, with boundaries.", capabilitiesLead: "A clear separation between what works today and what is being built next.", how: "From intent to evidence.", steps: ["AI defines the task.", "ExportFlow validates and coordinates execution.", "Specialized engines perform permitted operations.", "Results are collected and validated.", "Structured outputs and evidence are returned."], developersTitle: "Built for developers. Designed for agents.", developersLead: "A contract-first foundation for predictable integrations, structured results, and observable execution.", illustrative: "Illustrative example · not a live API contract", trust: "Designed for controlled execution.", trustLead: "Reliable infrastructure starts with explicit boundaries, visible outcomes, and careful handling of every request.", finalTitle: "Move beyond AI reasoning. Into execution.", finalCta: "Start building with ExportFlow", learn: "Learn more", footer: "The execution layer for AI.", placeholder: "This page is a structured starting point. Product details will be updated as capabilities become available.", contactIntro: "Fill in the form and your email app will open with a draft. Review the details and send it from your email account.", formName: "Name", formEmail: "Email", formSubject: "Subject", formMessage: "Message", send: "Prepare message", consent: "Your details will only be used to respond to this inquiry.", legalReview: "Review required before publication: confirm the legal entity, jurisdiction, contact details, and binding terms with counsel.", locale: "Language", exploreDocs: "Explore developer resources" },
  fr: { product: "Produit", solutions: "Solutions", developers: "Développeurs", pricing: "Tarifs", resources: "Ressources", about: "À propos", contact: "Contact", signIn: "Connexion", start: "Commencer", eyebrow: "INFRASTRUCTURE D’EXÉCUTION POUR AGENTS", hero: "Donnez à l’IA le pouvoir d’agir.", lead: "De l’intelligence web à l’automatisation du navigateur, ExportFlow fournit l’infrastructure d’exécution qui aide les agents IA à transformer des plans complexes en résultats vérifiables.", explore: "Explorer la plateforme", available: "Disponible en local", development: "En développement", planned: "Prévu", capabilities: "L’exécution, avec des limites.", capabilitiesLead: "Une distinction claire entre les fonctions disponibles et celles en cours de conception.", how: "De l’intention aux preuves.", steps: ["L’IA définit la tâche.", "ExportFlow valide et coordonne l’exécution.", "Des moteurs spécialisés réalisent les opérations autorisées.", "Les résultats sont collectés et validés.", "Les sorties structurées et les preuves sont renvoyées."], developersTitle: "Conçu pour les développeurs. Pensé pour les agents.", developersLead: "Une base fondée sur des contrats, des résultats structurés et une exécution observable.", illustrative: "Exemple illustratif · pas un contrat API actif", trust: "Pensé pour une exécution contrôlée.", trustLead: "Une infrastructure fiable repose sur des limites explicites et des résultats transparents.", finalTitle: "Au-delà du raisonnement. Passez à l’exécution.", finalCta: "Commencer avec ExportFlow", learn: "En savoir plus", footer: "La couche d’exécution pour l’IA.", placeholder: "Cette page constitue une base structurée. Les détails évolueront avec les fonctionnalités.", contactIntro: "Remplissez le formulaire : votre application de messagerie s'ouvrira avec un brouillon. Vérifiez les informations et envoyez-le depuis votre compte e-mail.", formName: "Nom", formEmail: "E-mail", formSubject: "Sujet", formMessage: "Message", send: "Préparer le message", consent: "Vos coordonnées serviront uniquement à répondre à cette demande.", legalReview: "À vérifier avant publication : entité juridique, juridiction, coordonnées et conditions avec un conseil.", locale: "Langue", exploreDocs: "Explorer les ressources développeur" },
  es: { product: "Producto", solutions: "Soluciones", developers: "Desarrolladores", pricing: "Precios", resources: "Recursos", about: "Acerca de", contact: "Contacto", signIn: "Iniciar sesión", start: "Empezar", eyebrow: "INFRAESTRUCTURA DE EJECUCIÓN PARA AGENTES", hero: "Dale a la IA el poder de ejecutar.", lead: "Desde inteligencia web hasta automatización del navegador, ExportFlow ofrece la infraestructura que ayuda a los agentes de IA a convertir planes complejos en resultados verificables.", explore: "Explorar la plataforma", available: "Disponible en local", development: "En desarrollo", planned: "Planificado", capabilities: "Ejecución con límites claros.", capabilitiesLead: "Una distinción clara entre lo disponible hoy y lo que está en desarrollo.", how: "De la intención a la evidencia.", steps: ["La IA define la tarea.", "ExportFlow valida y coordina la ejecución.", "Los motores especializados realizan las operaciones permitidas.", "Los resultados se recopilan y validan.", "Se devuelven resultados estructurados y evidencias."], developersTitle: "Para desarrolladores. Diseñado para agentes.", developersLead: "Una base basada en contratos para integraciones predecibles y resultados estructurados.", illustrative: "Ejemplo illustrativo · no es un contrato API activo", trust: "Diseñado para una ejecución controlada.", trustLead: "La infraestructura fiable empieza con límites explícitos y resultados transparentes.", finalTitle: "Más allá del razonamiento. A la ejecución.", finalCta: "Empieza a crear con ExportFlow", learn: "Más información", footer: "La capa de ejecución para IA.", placeholder: "Esta página es una base estructurada. Los detalles se actualizarán a medida que estén disponibles.", contactIntro: "Completa el formulario y se abrirá tu aplicación de correo con un borrador. Revisa los datos y envíalo desde tu cuenta.", formName: "Nombre", formEmail: "Correo electrónico", formSubject: "Asunto", formMessage: "Mensaje", send: "Preparar mensaje", consent: "Tus datos solo se usarán para responder a esta consulta.", legalReview: "Revisión necesaria antes de publicar: entidad legal, jurisdicción, datos de contacto y términos.", locale: "Idioma", exploreDocs: "Explorar recursos para desarrolladores" },
  de: { product: "Produkt", solutions: "Lösungen", developers: "Entwickler", pricing: "Preise", resources: "Ressourcen", about: "Über uns", contact: "Kontakt", signIn: "Anmelden", start: "Loslegen", eyebrow: "AUSFÜHRUNGSINFRASTRUKTUR FÜR AGENTEN", hero: "Gib KI die Fähigkeit zur Ausführung.", lead: "Von Web-Intelligence bis Browser-Automatisierung: ExportFlow unterstützt KI-Agenten dabei, komplexe Pläne in überprüfbare Ergebnisse umzusetzen.", explore: "Plattform entdecken", available: "Lokal verfügbar", development: "In Entwicklung", planned: "Geplant", capabilities: "Ausführung mit klaren Grenzen.", capabilitiesLead: "Klar getrennt: heute verfügbar und noch in Entwicklung.", how: "Von der Absicht zum Nachweis.", steps: ["Die KI definiert die Aufgabe.", "ExportFlow validiert und koordiniert die Ausführung.", "Spezialisierte Engines führen erlaubte Vorgänge aus.", "Ergebnisse werden gesammelt und validiert.", "Strukturierte Ergebnisse und Nachweise werden zurückgegeben."], developersTitle: "Für Entwickler gebaut. Für Agenten gedacht.", developersLead: "Eine vertragsorientierte Grundlage für vorhersehbare Integrationen und strukturierte Ergebnisse.", illustrative: "Illustratives Beispiel · kein aktiver API-Vertrag", trust: "Für kontrollierte Ausführung entwickelt.", trustLead: "Zuverlässige Infrastruktur beginnt mit klaren Grenzen und transparenten Ergebnissen.", finalTitle: "Weiter als KI-Reasoning. Hin zur Ausführung.", finalCta: "Mit ExportFlow starten", learn: "Mehr erfahren", footer: "Die Ausführungsebene für KI.", placeholder: "Diese Seite ist ein strukturierter Ausgangspunkt. Details folgen mit verfügbaren Funktionen.", contactIntro: "Fülle das Formular aus; deine E-Mail-App öffnet einen Entwurf. Prüfe die Angaben und sende ihn über dein E-Mail-Konto.", formName: "Name", formEmail: "E-Mail", formSubject: "Betreff", formMessage: "Nachricht", send: "Nachricht vorbereiten", consent: "Deine Angaben werden nur zur Beantwortung dieser Anfrage verwendet.", legalReview: "Vor Veröffentlichung prüfen: Rechtsträger, Gerichtsstand, Kontaktdaten und verbindliche Bedingungen.", locale: "Sprache", exploreDocs: "Entwicklerressourcen entdecken" },
  pt: { product: "Produto", solutions: "Soluções", developers: "Desenvolvedores", pricing: "Preços", resources: "Recursos", about: "Sobre", contact: "Contato", signIn: "Entrar", start: "Começar", eyebrow: "INFRAESTRUTURA DE EXECUÇÃO PARA AGENTES", hero: "Dê à IA o poder de executar.", lead: "Da inteligência web à automação de navegador, o ExportFlow ajuda agentes de IA a transformar planos complexos em resultados verificáveis.", explore: "Explorar a plataforma", available: "Disponível localmente", development: "Em desenvolvimento", planned: "Planejado", capabilities: "Execução com limites claros.", capabilitiesLead: "Uma distinção clara entre o que está disponível e o que está sendo desenvolvido.", how: "Da intenção à evidência.", steps: ["A IA define a tarefa.", "O ExportFlow valida e coordena a execução.", "Mecanismos especializados realizam operações permitidas.", "Os resultados são coletados e validados.", "Resultados estruturados e evidências são retornados."], developersTitle: "Feito para desenvolvedores. Projetado para agentes.", developersLead: "Uma base orientada a contratos para integrações previsíveis e resultados estruturados.", illustrative: "Exemplo ilustrativo · não é um contrato de API ativo", trust: "Projetado para execução controlada.", trustLead: "Infraestrutura confiável começa com limites explícitos e resultados transparentes.", finalTitle: "Além do raciocínio. Parta para a execução.", finalCta: "Comece a criar com ExportFlow", learn: "Saiba mais", footer: "A camada de execução para IA.", placeholder: "Esta página é uma base estruturada. Os detalhes serão atualizados conforme os recursos estiverem disponíveis.", contactIntro: "Preencha o formulário e seu aplicativo de e-mail abrirá um rascunho. Revise os dados e envie pela sua conta de e-mail.", formName: "Nome", formEmail: "E-mail", formSubject: "Assunto", formMessage: "Mensagem", send: "Preparar mensagem", consent: "Seus dados serão usados apenas para responder a esta solicitação.", legalReview: "Revisão necessária antes da publicação: entidade legal, jurisdição, contato e termos.", locale: "Idioma", exploreDocs: "Explorar recursos para desenvolvedores" },
  ar: { product: "المنتج", solutions: "الحلول", developers: "للمطورين", pricing: "الأسعار", resources: "الموارد", about: "من نحن", contact: "اتصل بنا", signIn: "تسجيل الدخول", start: "ابدأ الآن", eyebrow: "بنية تنفيذ الوكلاء", hero: "امنح الذكاء الاصطناعي القدرة على التنفيذ.", lead: "من ذكاء الويب إلى أتمتة المتصفح، توفر ExportFlow بنية تنفيذ تساعد وكلاء الذكاء الاصطناعي على تحويل الخطط المعقدة إلى نتائج قابلة للتحقق.", explore: "استكشف المنصة", available: "متاح محليًا", development: "قيد التطوير", planned: "مخطط له", capabilities: "تنفيذ ضمن حدود واضحة.", capabilitiesLead: "تمييز واضح بين ما يعمل اليوم وما لا يزال قيد التطوير.", how: "من النية إلى الدليل.", steps: ["يحدد الذكاء الاصطناعي المهمة.", "تتحقق ExportFlow من التنفيذ وتنسقه.", "تنفذ المحركات المتخصصة العمليات المسموح بها.", "تُجمع النتائج ويُتحقق منها.", "تُعاد المخرجات المنظمة والأدلة."], developersTitle: "مصممة للمطورين. ومهيأة للوكلاء.", developersLead: "أساس قائم على العقود لتكاملات متوقعة ونتائج منظمة.", illustrative: "مثال توضيحي · ليس عقد API فعليًا", trust: "مصممة لتنفيذ منضبط.", trustLead: "تبدأ البنية الموثوقة بحدود واضحة ونتائج شفافة.", finalTitle: "تجاوز التفكير إلى التنفيذ.", finalCta: "ابدأ البناء مع ExportFlow", learn: "اعرف المزيد", footer: "طبقة التنفيذ للذكاء الاصطناعي.", placeholder: "هذه الصفحة نقطة انطلاق منظمة. ستُحدّث التفاصيل مع توفر الإمكانات.", contactIntro: "املأ النموذج وسيفتح تطبيق البريد لديك مسودة جاهزة. راجع التفاصيل ثم أرسلها من حساب بريدك.", formName: "الاسم", formEmail: "البريد الإلكتروني", formSubject: "الموضوع", formMessage: "الرسالة", send: "إعداد الرسالة", consent: "ستُستخدم بياناتك فقط للرد على هذا الاستفسار.", legalReview: "يلزم التحقق قبل النشر: الكيان القانوني والاختصاص وبيانات الاتصال والشروط.", locale: "اللغة", exploreDocs: "استكشف موارد المطورين" },
  zh: { product: "产品", solutions: "解决方案", developers: "开发者", pricing: "定价", resources: "资源", about: "关于", contact: "联系", signIn: "登录", start: "开始使用", eyebrow: "智能体执行基础设施", hero: "赋予 AI 执行的能力。", lead: "从网络智能到浏览器自动化，ExportFlow 提供执行基础设施，帮助 AI 智能体将复杂计划转化为可验证的结果。", explore: "探索平台", available: "本地可用", development: "开发中", planned: "计划中", capabilities: "有边界的执行。", capabilitiesLead: "清晰区分当前可用能力与正在开发的功能。", how: "从意图到证据。", steps: ["AI 定义任务。", "ExportFlow 验证并协调执行。", "专用引擎执行获准的操作。", "收集并验证结果。", "返回结构化输出和证据。"], developersTitle: "为开发者构建，为智能体设计。", developersLead: "以契约为先，为可预测集成、结构化结果和可观察执行提供基础。", illustrative: "示意示例 · 非实际 API 契约", trust: "为受控执行而设计。", trustLead: "可靠基础设施始于明确边界与透明结果。", finalTitle: "超越 AI 推理，迈向执行。", finalCta: "开始构建 ExportFlow", learn: "了解更多", footer: "AI 的执行层。", placeholder: "此页面为结构化起点，功能可用后将更新详细信息。", contactIntro: "填写表单后，电子邮件应用会打开一封草稿。请检查内容并从自己的邮箱发送。", formName: "姓名", formEmail: "邮箱", formSubject: "主题", formMessage: "信息", send: "准备信息", consent: "您的信息仅用于回复此咨询。", legalReview: "发布前需审核：法律实体、司法管辖区、联系方式及约束性条款。", locale: "语言", exploreDocs: "浏览开发者资源" },
  ja: { product: "プロダクト", solutions: "ソリューション", developers: "開発者", pricing: "料金", resources: "リソース", about: "会社概要", contact: "お問い合わせ", signIn: "サインイン", start: "始める", eyebrow: "AIエージェント実行基盤", hero: "AIに実行する力を。", lead: "Webインテリジェンスからブラウザー自動化まで、ExportFlowはAIエージェントが複雑な計画を検証可能な結果へ変える実行基盤を提供します。", explore: "プラットフォームを見る", available: "ローカルで利用可能", development: "開発中", planned: "計画中", capabilities: "境界のある実行。", capabilitiesLead: "現在利用可能な機能と開発中の機能を明確に区別します。", how: "意図から証拠まで。", steps: ["AIがタスクを定義します。", "ExportFlowが検証し実行を調整します。", "専用エンジンが許可された操作を行います。", "結果を収集して検証します。", "構造化された出力と証拠を返します。"], developersTitle: "開発者のために構築し、エージェントのために設計。", developersLead: "予測可能な統合、構造化された結果、可観測な実行のための契約中心の基盤です。", illustrative: "参考例 · 実際のAPI契約ではありません", trust: "制御された実行のために設計。", trustLead: "信頼できる基盤は明確な境界と透明な結果から始まります。", finalTitle: "AIの推論を超えて、実行へ。", finalCta: "ExportFlowで開発を始める", learn: "詳しく見る", footer: "AIの実行レイヤー。", placeholder: "このページは構造化された出発点です。機能の提供状況に応じて詳細を更新します。", contactIntro: "フォームに入力するとメールアプリに下書きが開きます。内容を確認して、ご自身のメールアカウントから送信してください。", formName: "氏名", formEmail: "メールアドレス", formSubject: "件名", formMessage: "メッセージ", send: "メッセージを準備", consent: "入力情報はお問い合わせへの返信にのみ使用します。", legalReview: "公開前に確認: 法人、管轄、連絡先、法的拘束力のある条件。", locale: "言語", exploreDocs: "開発者向けリソースを見る" },
};

const ROUTES = [
  ["/", "Give AI the Power to Execute", "Agent execution infrastructure that helps AI turn plans into verifiable outcomes.", "home"],
  ["/product", "Product", "One execution layer. Multiple engines. Verifiable outcomes."],
  ["/solutions", "Solutions", "Controlled agent execution for real-world workflows."],
  ["/pricing", "Pricing", "Pricing information will be published when plans are finalized."],
  ["/about", "About ExportFlow", "The execution infrastructure behind agentic systems."],
  ["/contact", "Contact", "Reach the ExportFlow team.", "contact"],
  ["/product/web-intelligence", "Web Intelligence", "Bounded retrieval and source evidence.", "available"],
  ["/product/browser-automation", "Browser Automation", "A future path for rendered pages and explicitly authorized interaction.", "planned"],
  ["/product/execution-orchestration", "Execution Orchestration", "Coordinate task validation, routing, and normalized results.", "development"],
  ["/product/persistent-intelligence", "Persistent Intelligence", "A planned foundation for durable task context and continuity.", "planned"],
  ["/product/developer-platform", "Developer Platform", "Explore the developer entry points and current execution contract.", "development"],
  ["/developers", "Developer Center", "Build on a contract-first execution foundation.", "developers"],
  ["/docs", "Documentation", "A developer documentation structure, ready for technical content."],
  ["/api-reference", "API Reference", "Reference content will be connected to the verified API contract."],
  ["/integrations", "Integrations", "Provider-neutral architecture and integration entry points."],
  ["/changelog", "Changelog", "A transparent record of product changes."],
  ["/blog", "Blog", "Ideas and updates from the ExportFlow team."],
  ["/resources", "Resources", "Technical resources for agent builders."],
  ["/faq", "Frequently Asked Questions", "Clear answers about the product and its current status."],
  ["/legal/terms", "Terms of Service", "Terms and conditions for use of ExportFlow."],
  ["/legal/privacy", "Privacy Policy", "How information is handled when using ExportFlow."],
  ["/legal/cookies", "Cookie Policy", "Information about cookies and similar technologies."],
  ["/legal/refund-policy", "Refund Policy", "Refund information will be provided when applicable plans are finalized."],
  ["/legal/acceptable-use", "Acceptable Use", "Responsible use principles for ExportFlow."],
  ["/legal/security", "Security", "Security practices and responsible disclosure information."],
  ...AUTH_ROUTES,
];

function hrefFor(path, locale) {
  return locale === "en" ? path : `/${locale}${path === "/" ? "" : path}`;
}

function statusFor(key, t) {
  return key === "available" ? t.available : key === "development" ? t.development : t.planned;
}

function statusBadgeHtml(state, t) {
  const variant = state === "available" ? "available" : state === "development" ? "dev" : "planned";
  const icon = state === "available"
    ? `<svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
    : state === "development"
      ? `<svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`
      : `<svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>`;
  return `<span class="ef-badge ef-badge-${variant}">${icon}<span>${escapeHtml(statusFor(state, t))}</span></span>`;
}

function arrowRightIcon(cls = "ef-icon ef-icon-sm ef-btn-arrow ef-dir-arrow") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
}

function arrowUpRightIcon(cls = "ef-icon ef-icon-sm ef-btn-arrow ef-dir-arrow") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

function capabilityIcon(num) {
  const icons = {
    "01": `<svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="3.6" y1="9" x2="20.4" y2="9"/><line x1="3.6" y1="15" x2="20.4" y2="15"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
    "02": `<svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="6.5" x2="8.01" y2="6.5"/><line x1="11.5" y1="6.5" x2="11.51" y2="6.5"/></svg>`,
    "03": `<svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
    "04": `<svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7"/></svg>`,
    "05": `<svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  };
  return icons[num] || icons["01"];
}

function logo(locale = "en") {
  return `<a class="ef-brand ef-brand-new" href="${hrefFor("/", locale)}" aria-label="ExportFlow home">
    <span class="ef-mark" aria-hidden="true">
      <svg class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12h6M14 6h6M14 18h6M10 12l4-6m-4 6 4 6"/>
        <circle cx="4" cy="12" r="1.8" fill="currentColor"/>
        <circle cx="20" cy="6" r="1.8"/>
        <circle cx="20" cy="18" r="1.8"/>
      </svg>
    </span>
    <span>Export<span class="ef-brand-muted">Flow</span></span>
  </a>`;
}

function languageSwitcherHtml(locale, t, idSuffix) {
  const currentLabel = LANGUAGE_LABELS.find(([code]) => code === locale)?.[1] ?? "English";
  return `<div class="ef-lang-switcher" data-lang-switcher>
    <button
      type="button"
      class="ef-lang-trigger"
      data-lang-trigger
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-controls="ef-lang-menu-${idSuffix}"
      aria-label="${escapeHtml(t.locale)}: ${escapeHtml(currentLabel)}"
    >
      <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
      </svg>
      <span>${escapeHtml(currentLabel)}</span>
      <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <ul id="ef-lang-menu-${idSuffix}" class="ef-lang-menu" role="listbox" aria-label="${escapeHtml(t.locale)}" data-lang-menu hidden>
      ${LANGUAGE_LABELS.map(([code, label]) => `<li role="none">
        <button type="button" class="ef-lang-option" role="option" data-lang-option="${code}" aria-selected="${code === locale ? "true" : "false"}">
          <span>${escapeHtml(label)}</span>
          <span class="ef-lang-code">${code}</span>
        </button>
      </li>`).join("")}
    </ul>
  </div>`;
}

function themeToggleButton() {
  return `<button type="button" class="ef-icon-btn" data-theme-toggle aria-pressed="false" aria-label="Switch to dark theme" title="Toggle color theme">
    <svg data-icon-moon class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <svg data-icon-sun class="ef-icon ef-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden>
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
    </svg>
  </button>`;
}

function header(path, locale, t) {
  const nav = [
    ["/product", t.product],
    ["/solutions", t.solutions],
    ["/developers", t.developers],
    ["/pricing", t.pricing],
    ["/resources", t.resources],
  ];

  return `<header class="ef-header ef-header-new" data-site-header>
    <div class="ef-container ef-header-inner">
      ${logo(locale)}
      <nav class="ef-nav" aria-label="Primary navigation">
        ${nav.map(([href, label]) => `<a href="${hrefFor(href, locale)}"${path === href ? ` aria-current="page"` : ""}>${escapeHtml(label)}</a>`).join("")}
      </nav>
      <div class="ef-header-actions">
        ${languageSwitcherHtml(locale, t, "header")}
        ${themeToggleButton()}
        <a class="ef-signin-link" href="${hrefFor("/signin", locale)}" data-auth-header-link data-signin-href="${hrefFor("/signin", locale)}" data-account-href="${hrefFor("/account", locale)}" data-signin-label="${escapeHtml(t.signIn)}"${path === "/signin" || path === "/account" ? ` aria-current="page"` : ""}>${escapeHtml(t.signIn)}</a>
        <a class="ef-btn ef-btn-primary ef-btn-sm ef-header-cta" href="${hrefFor("/developers", locale)}">
          <span>${escapeHtml(t.start)}</span>
          ${arrowUpRightIcon("ef-icon ef-icon-xs ef-btn-arrow ef-dir-arrow")}
        </a>
        <button class="ef-menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-nav-drawer" aria-label="Open navigation menu">
          <svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
  <div class="ef-drawer-backdrop" data-drawer-backdrop></div>
  <aside class="ef-mobile-drawer" id="mobile-nav-drawer" data-mobile-drawer role="dialog" aria-modal="true" aria-label="Mobile navigation" hidden>
    <div class="ef-drawer-head">
      ${logo(locale)}
      <button type="button" class="ef-icon-btn" data-drawer-close aria-label="Close navigation menu">
        <svg class="ef-icon ef-icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <nav class="ef-drawer-nav" aria-label="Mobile links">
      ${nav.map(([href, label]) => `<a href="${hrefFor(href, locale)}"${path === href ? ` aria-current="page"` : ""}><span>${escapeHtml(label)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>`).join("")}
      <a href="${hrefFor("/signin", locale)}"${path === "/signin" ? ` aria-current="page"` : ""}><span>${escapeHtml(t.signIn)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
      <a href="${hrefFor("/account", locale)}"${path === "/account" ? ` aria-current="page"` : ""}><span>${escapeHtml(getAuthCopy(locale).accountNavLabel)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
      <a href="${hrefFor("/contact", locale)}"${path === "/contact" ? ` aria-current="page"` : ""}><span>${escapeHtml(t.contact)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
    </nav>
    <div class="ef-drawer-actions">
      <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
        <span>${escapeHtml(t.start)}</span>
        ${arrowUpRightIcon()}
      </a>
      <a class="ef-btn ef-btn-secondary" href="${hrefFor("/product", locale)}">
        <span>${escapeHtml(t.explore)}</span>
      </a>
    </div>
  </aside>`;
}

function footer(locale, t) {
  const at = getAuthCopy(locale);
  const groups = [
    ["Platform", [["/product", t.product], ["/solutions", t.solutions], ["/pricing", t.pricing], ["/signin", t.signIn], ["/account", at.accountNavLabel]]],
    [t.developers, [["/developers", t.developers], ["/docs", "Documentation"], ["/api-reference", "API reference"], ["/integrations", "Integrations"]]],
    [t.resources, [["/about", t.about], ["/blog", "Blog"], ["/resources", t.resources], ["/contact", t.contact]]],
    ["Legal", [["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"], ["/legal/cookies", "Cookies"], ["/legal/security", "Security"]]],
  ];

  return `<footer class="ef-footer ef-footer-new">
    <div class="ef-container">
      <div class="ef-footer-grid">
        <div>
          ${logo(locale)}
          <p class="ef-footer-brand-desc">${escapeHtml(t.footer)}<br>${escapeHtml(SITE_META.tagline)}</p>
          <div class="ef-footer-controls">
            ${languageSwitcherHtml(locale, t, "footer")}
            ${themeToggleButton()}
          </div>
        </div>
        ${groups.map(([title, links]) => `<div class="ef-footer-col">
          <h2>${escapeHtml(title)}</h2>
          <ul>
            ${links.map(([href, label]) => `<li><a href="${hrefFor(href, locale)}">${escapeHtml(label)}</a></li>`).join("")}
          </ul>
        </div>`).join("")}
      </div>
      <div class="ef-footer-bottom">
        <span>© 2026 ExportFlow</span>
        <span>Built for clear, bounded execution.</span>
        <span>Social and support links will be published when verified.</span>
      </div>
    </div>
  </footer>`;
}

function homeBody(t, locale) {
  const cards = [
    [
      "01",
      "Web intelligence",
      "Bounded public web retrieval with structured source evidence.",
      "available",
      "/product/web-intelligence",
      ["http.fetch.v1", "1 MiB body cap", "8s timeout"],
    ],
    [
      "02",
      "Execution orchestration",
      "Task validation, deterministic routing, and normalized outcomes.",
      "development",
      "/product/execution-orchestration",
      ["executeWebTask()", "lifecycle events"],
    ],
    [
      "03",
      "Developer ecosystem",
      "Documentation, integration concepts, and clear API boundaries.",
      "development",
      "/product/developer-platform",
      ["REST contract", "MCP planned"],
    ],
    [
      "04",
      "Browser infrastructure",
      "A distinct path for rendered pages and authorized interaction.",
      "planned",
      "/product/browser-automation",
      ["web.browser.v1", "501 until configured"],
    ],
    [
      "05",
      "Persistent intelligence",
      "Durable context and long-running task infrastructure.",
      "planned",
      "/product/persistent-intelligence",
      ["async queues", "durable state"],
    ],
  ];

  const stepSpecs = [
    {
      index: "01",
      phase: "Contract Ingress",
      module: "task-contract.js · readBoundedJsonBody()",
      guard: "Content-Type application/json · <= 32 KiB · allowed keys only",
      summary: "The AI agent emits intent, target URL, and explicit resource limits without owning transport details.",
    },
    {
      index: "02",
      phase: "Auth & Policy Validation",
      module: "auth.js + egress-guard.js",
      guard: "Bearer SHA-256 verify · isolate rate limit · public DNS only",
      summary: "Every request is authenticated fail-closed and checked against private IP, local domain, and port restrictions.",
    },
    {
      index: "03",
      phase: "Deterministic Routing",
      module: "router.js · chooseExecutionPath()",
      guard: "http.fetch.v1 default · browser escalations blocked until bound",
      summary: "ExportFlow selects the lightest permitted engine path and binds explicit timeout, byte, and redirect caps.",
    },
    {
      index: "04",
      phase: "Bounded Engine Execution",
      module: "http-fetch.js · manual redirect hops",
      guard: "<= 3 redirects · re-validated per hop · 1 MiB body stream cap",
      summary: "The active engine runs inside strict memory and time envelopes with no raw upstream exception leakage.",
    },
    {
      index: "05",
      phase: "Normalized Provenance Return",
      module: "result.js · ExecutionResult",
      guard: "sources[].evidence · finalUrl · durationMs · usage",
      summary: "Outputs normalize into a deterministic JSON envelope carrying status, structured data, and source evidence.",
    },
  ];

  const trustPoints = [
    ["Controlled execution", "Every task runs inside caller-defined timeout, byte, and redirect limits."],
    ["Transparent outcomes", "Supported and unsupported paths return explicit states—never silent failures."],
    ["Evidence and provenance", "Resolved URLs, redirect counts, HTTP statuses, and timestamps travel with results."],
    ["Resource-aware limits", "Requests cap at 32 KiB JSON and stream responses safely up to 1 MiB."],
    ["Security-conscious boundaries", "Private IPs, loopback hosts, credentials in URLs, and HTTP downgrades are rejected."],
    ["Provider-neutral design", "Model-agnostic JSON contracts decouple AI reasoning from engine implementations."],
  ];

  return `
  <!-- HERO -->
  <section class="ef-hero" data-hero-section>
    <div class="ef-hero-bg" aria-hidden="true">
      <div class="ef-hero-grid-bg"></div>
      <div class="ef-hero-aurora"></div>
    </div>

    <div class="ef-container ef-hero-grid">
      <div class="ef-hero-copy">
        <p class="ef-eyebrow ef-hero-stagger ef-stagger-1">
          <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>${escapeHtml(t.eyebrow)}</span>
        </p>
        <h1 class="ef-hero-title ef-hero-stagger ef-stagger-2">${escapeHtml(t.hero)}</h1>
        <p class="ef-hero-lead ef-hero-stagger ef-stagger-3">${escapeHtml(t.lead)}</p>
        <p class="ef-hero-tagline ef-hero-stagger ef-stagger-3">${escapeHtml(SITE_META.tagline)}</p>
        <div class="ef-hero-actions ef-hero-stagger ef-stagger-4">
          <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
            <span>${escapeHtml(t.start)}</span>
            ${arrowUpRightIcon()}
          </a>
          <a class="ef-btn ef-btn-secondary" href="${hrefFor("/product", locale)}">
            <span>${escapeHtml(t.explore)}</span>
            ${arrowRightIcon()}
          </a>
        </div>
        <div class="ef-hero-meta ef-hero-stagger ef-stagger-5">
          ${statusBadgeHtml("available", { available: `${t.available} · HTTP Fetch` })}
          <button type="button" class="ef-motion-toggle" data-motion-toggle aria-pressed="false">
            <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <span data-motion-label>Pause motion</span>
          </button>
        </div>
      </div>

      ${renderExecutionGraph({
        availableLabel: t.available,
        developmentLabel: t.development,
        plannedLabel: t.planned,
      })}
    </div>
  </section>

  <!-- 01 PLATFORM CAPABILITIES -->
  <section class="ef-section" aria-labelledby="cap-heading">
    <div class="ef-container">
      <div class="ef-section-head-split ef-reveal" data-reveal>
        <div class="ef-section-head">
          <p class="ef-eyebrow">01 · Platform capabilities</p>
          <h2 id="cap-heading" class="ef-section-title">${escapeHtml(t.capabilities)}</h2>
          <p class="ef-section-lead">${escapeHtml(t.capabilitiesLead)}</p>
        </div>

        <div class="ef-cap-filter-bar" role="group" aria-label="Filter capabilities by maturity">
          <button type="button" class="ef-filter-pill" data-cap-filter="all" aria-pressed="true">All (5)</button>
          <button type="button" class="ef-filter-pill" data-cap-filter="available" aria-pressed="false">${escapeHtml(t.available)}</button>
          <button type="button" class="ef-filter-pill" data-cap-filter="development" aria-pressed="false">${escapeHtml(t.development)}</button>
          <button type="button" class="ef-filter-pill" data-cap-filter="planned" aria-pressed="false">${escapeHtml(t.planned)}</button>
        </div>
      </div>

      <div class="ef-cap-grid" data-cap-grid>
        ${cards.map(([num, title, desc, state, href, meta], i) => {
          const isFeatured = state === "available";
          const isPlanned = state === "planned";
          const cardClasses = [
            "ef-cap-card",
            "ef-reveal",
            isFeatured ? "ef-cap-card-featured" : "",
            isPlanned ? "ef-cap-card-planned" : "",
          ].filter(Boolean).join(" ");

          return `<a class="${cardClasses}" href="${hrefFor(href, locale)}" data-cap-card data-cap-state="${state}" data-reveal data-reveal-delay="${i * 65}" data-glow-card>
            <div class="ef-cap-top">
              <span class="ef-cap-num">${num}</span>
              ${statusBadgeHtml(state, t)}
            </div>
            <div class="ef-cap-icon">${capabilityIcon(num)}</div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(desc)}</p>
            <ul class="ef-cap-meta-list" aria-label="Boundary summary">
              ${meta.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}
            </ul>
            <span class="ef-cap-link">
              <span>${escapeHtml(t.learn)}</span>
              ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
            </span>
          </a>`;
        }).join("")}
      </div>

      <div class="ef-status-legend ef-reveal" data-reveal role="note" aria-label="Capability status legend">
        <span class="ef-legend-title">Status legend</span>
        <ul class="ef-legend-items">
          <li>${statusBadgeHtml("available", t)} <span>Implemented and verified in local runtime</span></li>
          <li>${statusBadgeHtml("development", t)} <span>Active architecture and contract work</span></li>
          <li>${statusBadgeHtml("planned", t)} <span>Designed path; not yet enabled</span></li>
        </ul>
      </div>
    </div>
  </section>

  <!-- 02 EXECUTION MODEL -->
  <section class="ef-section ef-section-alt" aria-labelledby="exec-heading">
    <div class="ef-container">
      <div class="ef-section-head ef-reveal" data-reveal>
        <p class="ef-eyebrow">02 · Execution model</p>
        <h2 id="exec-heading" class="ef-section-title">${escapeHtml(t.how)}</h2>
      </div>

      <div class="ef-exec-model-grid">
        <ol class="ef-timeline" data-exec-timeline>
          <div class="ef-timeline-track" aria-hidden="true">
            <div class="ef-timeline-fill"></div>
          </div>
          ${t.steps.map((step, i) => `<li class="ef-timeline-step${i === 0 ? " is-active" : ""}" data-timeline-step data-step-index="${i}">
            <button type="button" class="ef-timeline-trigger" data-step-trigger="${i}" aria-pressed="${i === 0 ? "true" : "false"}">
              <span class="ef-timeline-dot" aria-hidden="true">0${i + 1}</span>
              <span class="ef-timeline-card">
                <span class="ef-timeline-phase">${escapeHtml(stepSpecs[i].phase)}</span>
                <span class="ef-timeline-text">${escapeHtml(step)}</span>
              </span>
            </button>
          </li>`).join("")}
        </ol>

        <aside class="ef-step-inspector ef-reveal" data-reveal data-step-inspector aria-live="polite">
          <div class="ef-step-inspector-head">
            <span class="ef-step-insp-idx" data-step-insp-idx>STEP 01</span>
            <span class="ef-step-insp-badge">Pipeline Stage</span>
          </div>
          <h3 class="ef-step-insp-title" data-step-insp-title>${escapeHtml(stepSpecs[0].phase)}</h3>
          <p class="ef-step-insp-desc" data-step-insp-desc>${escapeHtml(stepSpecs[0].summary)}</p>
          <dl class="ef-step-insp-dl">
            <div>
              <dt>Core Module</dt>
              <dd data-step-insp-module>${escapeHtml(stepSpecs[0].module)}</dd>
            </div>
            <div>
              <dt>Enforced Guardrails</dt>
              <dd data-step-insp-guard>${escapeHtml(stepSpecs[0].guard)}</dd>
            </div>
          </dl>
          <div class="ef-step-insp-foot">
            <a class="ef-cap-link" href="/demo">
              <span>Inspect in interactive preview</span>
              ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
            </a>
          </div>
          <script type="application/json" data-step-meta>${JSON.stringify(stepSpecs).replaceAll("<", "\\u003c")}</script>
        </aside>
      </div>
    </div>
  </section>

  <!-- 03 DEVELOPER FIRST -->
  <section class="ef-section" aria-labelledby="dev-heading">
    <div class="ef-container ef-dev-grid">
      <div class="ef-reveal" data-reveal>
        <p class="ef-eyebrow">03 · Developer first</p>
        <h2 id="dev-heading" class="ef-section-title">${escapeHtml(t.developersTitle)}</h2>
        <p class="ef-section-lead">${escapeHtml(t.developersLead)}</p>
        <div class="ef-dev-actions">
          <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
            <span>${escapeHtml(t.exploreDocs)}</span>
            ${arrowRightIcon()}
          </a>
          <a class="ef-btn ef-btn-secondary" href="/demo">
            <span>Interactive browser preview</span>
            ${arrowUpRightIcon()}
          </a>
        </div>
      </div>

      <div class="ef-code-card ef-reveal" data-reveal data-typewriter-card>
        <div class="ef-code-head">
          <div class="ef-code-tabs" role="tablist" aria-label="Illustrative contract views">
            <button type="button" class="ef-code-tab" role="tab" data-code-tab="request" aria-selected="true">task.contract.example.json</button>
            <button type="button" class="ef-code-tab" role="tab" data-code-tab="response" aria-selected="false">result.200.json</button>
            <button type="button" class="ef-code-tab" role="tab" data-code-tab="guard" aria-selected="false">guard.501.json</button>
          </div>
          <div class="ef-code-tools">
            <span class="ef-code-pill">ILLUSTRATIVE</span>
            <button type="button" class="ef-code-btn" data-typewriter-replay aria-label="Replay illustrative contract trace">
              <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Run</span>
            </button>
            <button type="button" class="ef-code-btn" data-copy-code aria-label="Copy JSON example">
              <svg data-icon-copy class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <svg data-icon-check class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><polyline points="20 6 9 17 4 12"/></svg>
              <span data-copy-label>Copy</span>
            </button>
          </div>
        </div>

        <pre class="ef-code-pre"><code><span data-typewriter-target></span><span class="ef-type-cursor" data-type-cursor aria-hidden="true"></span></code></pre>

        <div class="ef-code-result" data-typewriter-result aria-live="polite">
          <div class="ef-code-result-bar">
            <span class="ef-code-result-status" data-code-status>
              <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span>ILLUSTRATIVE · status: ok · 142ms · evidence attached</span>
            </span>
            <span class="ef-code-result-note" data-code-adapter>adapter: http.fetch.v1</span>
          </div>
        </div>

        <div class="ef-code-foot">
          <span>${escapeHtml(t.illustrative)}</span>
          <span>JSON</span>
        </div>
      </div>
    </div>
  </section>

  <!-- 04 TRUST BY DESIGN -->
  <section class="ef-section ef-section-alt" aria-labelledby="trust-heading">
    <div class="ef-container ef-trust-grid">
      <div class="ef-reveal" data-reveal>
        <p class="ef-eyebrow">04 · Trust by design</p>
        <h2 id="trust-heading" class="ef-section-title">${escapeHtml(t.trust)}</h2>
        <p class="ef-section-lead">${escapeHtml(t.trustLead)}</p>
      </div>

      <ul class="ef-trust-list ef-reveal" data-reveal data-trust-list>
        ${trustPoints.map(([label, desc]) => `<li class="ef-trust-item">
          <svg class="ef-trust-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" opacity="0.28"/>
            <path class="ef-check-path" d="M8.5 12.5 L11 15 L16 9.5"/>
          </svg>
          <div>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(desc)}</p>
          </div>
        </li>`).join("")}
      </ul>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="ef-final-cta" aria-labelledby="final-cta-heading">
    <div class="ef-container ef-reveal" data-reveal>
      <p class="ef-eyebrow">ExportFlow · Execution layer</p>
      <h2 id="final-cta-heading">${escapeHtml(t.finalTitle)}</h2>
      <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
        <span>${escapeHtml(t.finalCta)}</span>
        ${arrowUpRightIcon()}
      </a>
    </div>
  </section>

  <!-- MOBILE THUMB-SAFE CTA BAR -->
  <div class="ef-mobile-sticky-cta">
    <span>HTTP Fetch · Available locally</span>
    <a class="ef-btn ef-btn-primary ef-btn-sm" href="${hrefFor("/developers", locale)}">
      <span>${escapeHtml(t.start)}</span>
      ${arrowUpRightIcon("ef-icon ef-icon-xs ef-btn-arrow ef-dir-arrow")}
    </a>
  </div>`;
}

function genericBody(route, path, t, locale) {
  const [url, title, description, type] = route;
  const isLegal = path.startsWith("/legal/");

  if (type && type.startsWith("auth-")) {
    return renderAuthPage(type, t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon);
  }

  if (type === "contact") {
    return `<section class="ef-page-hero">
      <div class="ef-container">
        <p class="ef-eyebrow">EXPORTFLOW / CONTACT</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="ef-page-lead">${escapeHtml(t.contactIntro)}</p>
      </div>
    </section>
    <section class="ef-section">
      <div class="ef-container ef-contact-layout">
        <div>
          <h2 class="ef-section-title">Direct contact</h2>
          <div class="ef-channel-list">
            <article class="ef-channel-item">
              <div>
                <h3>Email</h3>
                <p>General, technical, developer, and business inquiries.</p>
                <a class="ef-cap-link" href="mailto:hhameranede@gmail.com">hhameranede@gmail.com</a>
              </div>
              <span class="ef-badge ef-badge-available">Available</span>
            </article>
          </div>
          <p class="ef-section-lead ef-mt-20 ef-text-sm">The form below opens a draft in your email app. You review and send it from your own account.</p>
        </div>
        <form class="ef-contact-form" data-contact-form novalidate>
          <div class="ef-field">
            <label for="cf-name">${escapeHtml(t.formName)}</label>
            <input id="cf-name" name="name" autocomplete="name" required maxlength="120" aria-describedby="err-name">
            <span id="err-name" class="ef-field-error" data-error-for="name" role="alert"></span>
          </div>
          <div class="ef-field">
            <label for="cf-email">${escapeHtml(t.formEmail)}</label>
            <input id="cf-email" name="email" type="email" autocomplete="email" required maxlength="254" aria-describedby="err-email">
            <span id="err-email" class="ef-field-error" data-error-for="email" role="alert"></span>
          </div>
          <div class="ef-field">
            <label for="cf-subject">${escapeHtml(t.formSubject)}</label>
            <select id="cf-subject" name="subject" required aria-describedby="err-subject">
              <option value="">Select an inquiry type</option>
              <option>General inquiry</option>
              <option>Technical support</option>
              <option>Developer inquiry</option>
              <option>Business inquiry</option>
            </select>
            <span id="err-subject" class="ef-field-error" data-error-for="subject" role="alert"></span>
          </div>
          <div class="ef-field">
            <label for="cf-message">${escapeHtml(t.formMessage)}</label>
            <textarea id="cf-message" name="message" rows="5" required maxlength="4000" aria-describedby="err-message"></textarea>
            <span id="err-message" class="ef-field-error" data-error-for="message" role="alert"></span>
          </div>
          <div>
            <label class="ef-consent">
              <input type="checkbox" name="consent" required aria-describedby="err-consent">
              <span>${escapeHtml(t.consent)}</span>
            </label>
            <span id="err-consent" class="ef-field-error" data-error-for="consent" role="alert"></span>
          </div>
          <button class="ef-btn ef-btn-primary" type="submit">
            <span>${escapeHtml(t.send)}</span>
            ${arrowRightIcon()}
          </button>
          <p class="ef-form-banner" role="status" data-form-status>Frontend only — no message is sent.</p>
        </form>
      </div>
    </section>`;
  }

  const badgeState = type === "available" ? "available" : type === "development" || type === "developers" ? "development" : "planned";
  const content = isLegal
    ? `<div class="ef-legal-review" role="note">${escapeHtml(t.legalReview)}</div>
       <h2>1. Scope</h2>
       <p>This document provides a publication-ready structure for the ${escapeHtml(title.toLowerCase())}. It is not legal advice and is not a binding statement of terms.</p>
       <h2>2. Information to confirm</h2>
       <p>Confirm the legal entity, governing jurisdiction, data practices, applicable rights, retention periods, and contact channel before publication.</p>
       <h2>3. Product status</h2>
       <p>Descriptions of ExportFlow capabilities must reflect the current published product status. No service level, certification, warranty, or availability commitment is implied here.</p>
       <h2>4. Contact and effective date</h2>
       <p>Add a verified contact method and effective date after review by qualified counsel.</p>`
    : `<div class="ef-status-banner">
         ${statusBadgeHtml(badgeState, t)}
         <span>Capability status is described conservatively and is subject to change.</span>
       </div>
       <h2>What this means</h2>
       <p>${escapeHtml(description)} ExportFlow separates model reasoning from bounded execution so operations can be validated, routed, and returned with structured outcomes.</p>
       <h2>Current foundation</h2>
       <p>The repository includes a locally verified, authenticated HTTP Fetch adapter with egress controls, response limits, redirect validation, and source metadata. Production availability is not represented here.</p>
       <h2>Designed for clear contracts</h2>
       <p>Engine-specific behavior is isolated behind a consistent task contract. Planned capabilities are labeled and are not presented as active services.</p>
       <div class="ef-sub-grid">
         <div class="ef-info-card">
           <h3>Interactive browser preview</h3>
           <p>Inspect validation rules, egress guards, and normalized JSON envelopes without sending external requests.</p>
           <p class="ef-mt-12"><a class="ef-cap-link" href="/demo">Launch preview ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
         </div>
         <div class="ef-info-card">
           <h3>Developer documentation</h3>
           <p>Explore the Phase 1 task contract, adapter catalog, and local runtime instructions.</p>
           <p class="ef-mt-12"><a class="ef-cap-link" href="${hrefFor("/developers", locale)}">${escapeHtml(t.exploreDocs)} ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
         </div>
       </div>`;

  return `<section class="ef-page-hero">
    <div class="ef-container">
      <p class="ef-eyebrow">${isLegal ? "EXPORTFLOW / LEGAL" : `EXPORTFLOW / ${escapeHtml(url.replaceAll("/", " · ").slice(1).toUpperCase())}`}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="ef-page-lead">${escapeHtml(description)}</p>
    </div>
  </section>
  <section class="ef-section">
    <article class="ef-container ef-article">
      ${content}
    </article>
  </section>`;
}

export function renderMarketingPage(requestUrl, routePath, locale = "en") {
  const selectedLocale = LANGUAGES.includes(locale) ? locale : "en";
  const t = COPY[selectedLocale];
  const route = ROUTES.find(([path]) => path === routePath) || ROUTES[1];
  const title = route[1];
  const description = route[2];
  const isAuthRoute = AUTH_ROUTES.some(([authPath]) => authPath === routePath);

  const body = `${header(routePath, selectedLocale, t)}${
    routePath === "/" ? homeBody(t, selectedLocale) : genericBody(route, routePath, t, selectedLocale)
  }${footer(selectedLocale, t)}`;

  const fontFamilies = {
    ar: "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
    zh: "Noto+Sans+SC:wght@400;500;600;700",
    ja: "Noto+Sans+JP:wght@400;500;600;700",
  };
  const fontFamily = fontFamilies[selectedLocale];
  const extraHeadHtml = fontFamily
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fontFamily}&display=swap">`
    : "";

  const ogEyebrow = routePath === "/"
    ? t.eyebrow
    : routePath.startsWith("/legal/")
      ? "EXPORTFLOW / LEGAL"
      : `EXPORTFLOW / ${routePath.replaceAll("/", " · ").slice(1).toUpperCase()}`;

  return renderDocument({
    path: hrefFor(routePath, selectedLocale),
    requestUrl,
    title: `${title} — ExportFlow`,
    description,
    bodyHtml: body,
    isMarketing: true,
    locale: selectedLocale,
    dir: selectedLocale === "ar" ? "rtl" : null,
    extraHeadHtml,
    ogTitle: routePath === "/" ? `${t.hero} — ExportFlow` : `${title} — ExportFlow`,
    ogEyebrow,
    includeAlternates: !isAuthRoute,
    robots: isAuthRoute ? "noindex, nofollow" : null,
  });
}

export function renderMarketingNotFoundPage(requestUrl, locale = "en") {
  const selectedLocale = LANGUAGES.includes(locale) ? locale : "en";
  const t = COPY[selectedLocale];
  const body = `${header("/404", selectedLocale, t)}
    <section class="ef-page-hero">
      <div class="ef-container">
        <p class="ef-eyebrow">404 / ROUTE NOT FOUND</p>
        <h1>This execution route does not exist.</h1>
        <p class="ef-page-lead">The requested path is not part of the ExportFlow site or API surface.</p>
        <div class="ef-hero-actions ef-mt-28">
          <a class="ef-btn ef-btn-primary" href="${hrefFor("/", selectedLocale)}">
            <span>Return home</span>
            ${arrowRightIcon()}
          </a>
          <a class="ef-btn ef-btn-secondary" href="${hrefFor("/developers", selectedLocale)}">
            <span>${escapeHtml(t.exploreDocs)}</span>
          </a>
        </div>
      </div>
    </section>
  ${footer(selectedLocale, t)}`;

  return renderDocument({
    path: "/404",
    requestUrl,
    title: "Page not found — ExportFlow",
    description: "The requested ExportFlow page could not be found.",
    bodyHtml: body,
    isMarketing: true,
    locale: selectedLocale,
    dir: selectedLocale === "ar" ? "rtl" : null,
    ogEyebrow: "404 / ROUTE NOT FOUND",
    includeAlternates: false,
    robots: "noindex, nofollow",
  });
}

export function resolveMarketingRoute(pathname) {
  let path = pathname;
  let locale = "en";
  const prefix = /^\/(en|ar|fr|es|de|pt|zh|ja)(\/.*)?$/.exec(pathname);
  if (prefix) {
    locale = prefix[1];
    path = prefix[2] || "/";
  }
  if (!ROUTES.some(([route]) => route === path)) return null;
  return { path, locale };
}

export const MARKETING_PATHS = ROUTES
  .filter(([path]) => !AUTH_ROUTES.some(([authPath]) => authPath === path))
  .map(([path]) => path)
  .flatMap((path) =>
    path === "/" ? ["/"] : [path, ...LANGUAGES.filter((locale) => locale !== "en").map((locale) => `/${locale}${path}`)],
  );
