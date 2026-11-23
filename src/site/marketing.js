import { renderDocument, escapeHtml } from "./layout.js";
import { SITE_META } from "./data.js";
import { renderExecutionGraph } from "./execution-graph.js";
import { AUTH_ROUTES, renderAuthPage, getAuthCopy } from "./auth-pages.js";
import { renderUnifiedRichRoute } from "./marketing-pages.js";
import { renderBrandCatSvg, renderFeatureIcon } from "./icons.js";
import { getLocaleData } from "./i18n.js";

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
  en: { product: "Product", platform: "Platform", useCases: "Use cases", demo: "Preview", solutions: "Solutions", developers: "Developers", pricing: "Pricing", resources: "Resources", about: "About", contact: "Contact", signIn: "Sign in", start: "Get started", eyebrow: "AGENT EXECUTION INFRASTRUCTURE", hero: "Give AI the Power to Execute.", lead: "From web intelligence to browser automation, ExportFlow provides the execution infrastructure that helps AI agents turn complex plans into verifiable results.", explore: "Explore the platform", available: "Available locally", development: "In development", planned: "Planned", capabilities: "Execution, with boundaries.", capabilitiesLead: "A clear separation between what works today and what is being built next.", how: "From intent to evidence.", steps: ["AI defines the task.", "ExportFlow validates and coordinates execution.", "Specialized engines perform permitted operations.", "Results are collected and validated.", "Structured outputs and evidence are returned."], developersTitle: "Built for developers. Designed for agents.", developersLead: "A contract-first foundation for predictable integrations, structured results, and observable execution.", illustrative: "Illustrative example · not a live API contract", trust: "Designed for controlled execution.", trustLead: "Reliable infrastructure starts with explicit boundaries, visible outcomes, and careful handling of every request.", finalTitle: "Move beyond AI reasoning. Into execution.", finalCta: "Start building with ExportFlow", learn: "Learn more", footer: "The execution layer for AI.", footerLegal: "Legal", footerBottomNote: "Built for clear, bounded execution.", footerSocialNote: "Official links publish when verified.", legendTitle: "Status legend", legendAvailable: "Implemented and verified in local runtime", legendDev: "Active architecture and contract work", legendPlanned: "Designed path; not yet enabled", notFoundTitle: "This execution route does not exist.", notFoundDesc: "The requested path is not part of the ExportFlow site or API surface.", returnHome: "Return home", placeholder: "This page is a structured starting point. Product details will be updated as capabilities become available.", contactIntro: "Reach the right team. Submitting prepares a pre-filled email draft in your default mail client; no remote ticket endpoint is active.", formName: "Name", formEmail: "Email", formSubject: "Subject", formMessage: "Message", send: "Prepare message", consent: "Your details will only be used to respond to this inquiry.", legalReview: "Review required before publication: confirm the legal entity, jurisdiction, contact details, and binding terms with counsel.", locale: "Language", exploreDocs: "Explore developer resources" },
  fr: { product: "Produit", platform: "Plateforme", useCases: "Cas d’usage", demo: "Aperçu", solutions: "Solutions", developers: "Développeurs", pricing: "Tarifs", resources: "Ressources", about: "À propos", contact: "Contact", signIn: "Connexion", start: "Commencer", eyebrow: "INFRASTRUCTURE D’EXÉCUTION POUR AGENTS", hero: "Donnez à l’IA le pouvoir d’agir.", lead: "De l’intelligence web à l’automatisation du navigateur, ExportFlow fournit l’infrastructure d’exécution qui aide les agents IA à transformer des plans complexes en résultats vérifiables.", explore: "Explorer la plateforme", available: "Disponible en local", development: "En développement", planned: "Prévu", capabilities: "L’exécution, avec des limites.", capabilitiesLead: "Une distinction claire entre les fonctions disponibles et celles en cours de conception.", how: "De l’intention aux preuves.", steps: ["L’IA définit la tâche.", "ExportFlow valide et coordonne l’exécution.", "Des moteurs spécialisés réalisent les opérations autorisées.", "Les résultats sont collectés et validés.", "Les sorties structurées et les preuves sont renvoyées."], developersTitle: "Conçu pour les développeurs. Pensé pour les agents.", developersLead: "Une base fondée sur des contrats, des résultats structurés et une exécution observable.", illustrative: "Exemple illustratif · pas un contrat API actif", trust: "Pensé pour une exécution contrôlée.", trustLead: "Une infrastructure fiable repose sur des limites explicites et des résultats transparents.", finalTitle: "Au-delà du raisonnement. Passez à l’exécution.", finalCta: "Commencer avec ExportFlow", learn: "En savoir plus", footer: "La couche d’exécution pour l’IA.", footerLegal: "Mentions légales", footerBottomNote: "Conçu pour une exécution claire et bornée.", footerSocialNote: "Les liens officiels seront publiés après vérification.", legendTitle: "Légende des statuts", legendAvailable: "Implémenté et vérifié en local", legendDev: "Architecture et contrats en cours", legendPlanned: "Trajectoire prévue, non activée", notFoundTitle: "Cette route d’exécution n’existe pas.", notFoundDesc: "Le chemin demandé ne fait pas partie du site ou de l’API ExportFlow.", returnHome: "Retour à l’accueil", placeholder: "Cette page constitue une base structurée. Les détails évolueront avec les fonctionnalités.", contactIntro: "Contactez la bonne équipe. L’envoi prépare un brouillon dans votre messagerie locale.", formName: "Nom", formEmail: "E-mail", formSubject: "Sujet", formMessage: "Message", send: "Préparer le message", consent: "Vos coordonnées serviront uniquement à répondre à cette demande.", legalReview: "À vérifier avant publication : entité juridique, juridiction, coordonnées et conditions avec un conseil.", locale: "Langue", exploreDocs: "Explorer les ressources développeur" },
  es: { product: "Producto", platform: "Plataforma", useCases: "Casos de uso", demo: "Vista previa", solutions: "Soluciones", developers: "Desarrolladores", pricing: "Precios", resources: "Recursos", about: "Acerca de", contact: "Contacto", signIn: "Iniciar sesión", start: "Empezar", eyebrow: "INFRAESTRUCTURA DE EJECUCIÓN PARA AGENTES", hero: "Dale a la IA el poder de ejecutar.", lead: "Desde inteligencia web hasta automatización del navegador, ExportFlow ofrece la infraestructura que ayuda a los agentes de IA a convertir planes complejos en resultados verificables.", explore: "Explorar la plataforma", available: "Disponible en local", development: "En desarrollo", planned: "Planificado", capabilities: "Ejecución con límites claros.", capabilitiesLead: "Una distinción clara entre lo disponible hoy y lo que está en desarrollo.", how: "De la intención a la evidencia.", steps: ["La IA define la tarea.", "ExportFlow valida y coordina la ejecución.", "Los motores especializados realizan las operaciones permitidas.", "Los resultados se recopilan y validan.", "Se devuelven resultados estructurados y evidencias."], developersTitle: "Para desarrolladores. Diseñado para agentes.", developersLead: "Una base basada en contratos para integraciones predecibles y resultados estructurados.", illustrative: "Ejemplo illustrativo · no es un contrato API activo", trust: "Diseñado para una ejecución controlada.", trustLead: "La infraestructura fiable empieza con límites explícitos y resultados transparentes.", finalTitle: "Más allá del razonamiento. A la ejecución.", finalCta: "Empieza a crear con ExportFlow", learn: "Más información", footer: "La capa de ejecución para IA.", footerLegal: "Legal", footerBottomNote: "Diseñado para una ejecución clara y acotada.", footerSocialNote: "Los enlaces oficiales se publicarán cuando se verifiquen.", legendTitle: "Leyenda de estados", legendAvailable: "Implementado y verificado en entorno local", legendDev: "Arquitectura y contrato en desarrollo", legendPlanned: "Ruta diseñada; aún no habilitada", notFoundTitle: "Esta ruta de ejecución no existe.", notFoundDesc: "La ruta solicitada no forma parte del sitio ni de la API de ExportFlow.", returnHome: "Volver al inicio", placeholder: "Esta página es una base estructurada. Los detalles se actualizarán a medida que estén disponibles.", contactIntro: "Contacta con el equipo adecuado. Al enviar se prepara un borrador en tu aplicación de correo.", formName: "Nombre", formEmail: "Correo electrónico", formSubject: "Asunto", formMessage: "Mensaje", send: "Preparar mensaje", consent: "Tus datos solo se usarán para responder a esta consulta.", legalReview: "Revisión necesaria antes de publicar: entidad legal, jurisdicción, datos de contacto y términos.", locale: "Idioma", exploreDocs: "Explorar recursos para desarrolladores" },
  de: { product: "Produkt", platform: "Plattform", useCases: "Anwendungsfälle", demo: "Vorschau", solutions: "Lösungen", developers: "Entwickler", pricing: "Preise", resources: "Ressourcen", about: "Über uns", contact: "Kontakt", signIn: "Anmelden", start: "Loslegen", eyebrow: "AUSFÜHRUNGSINFRASTRUKTUR FÜR AGENTEN", hero: "Gib KI die Fähigkeit zur Ausführung.", lead: "Von Web-Intelligence bis Browser-Automatisierung: ExportFlow unterstützt KI-Agenten dabei, komplexe Pläne in überprüfbare Ergebnisse umzusetzen.", explore: "Plattform entdecken", available: "Lokal verfügbar", development: "In Entwicklung", planned: "Geplant", capabilities: "Ausführung mit klaren Grenzen.", capabilitiesLead: "Klar getrennt: heute verfügbar und noch in Entwicklung.", how: "Von der Absicht zum Nachweis.", steps: ["Die KI definiert die Aufgabe.", "ExportFlow validiert und koordiniert die Ausführung.", "Spezialisierte Engines führen erlaubte Vorgänge aus.", "Ergebnisse werden gesammelt und validiert.", "Strukturierte Ergebnisse und Nachweise werden zurückgegeben."], developersTitle: "Für Entwickler gebaut. Für Agenten gedacht.", developersLead: "Eine vertragsorientierte Grundlage für vorhersehbare Integrationen und strukturierte Ergebnisse.", illustrative: "Illustratives Beispiel · kein aktiver API-Vertrag", trust: "Für kontrollierte Ausführung entwickelt.", trustLead: "Zuverlässige Infrastruktur beginnt mit klaren Grenzen und transparenten Ergebnissen.", finalTitle: "Weiter als KI-Reasoning. Hin zur Ausführung.", finalCta: "Mit ExportFlow starten", learn: "Mehr erfahren", footer: "Die Ausführungsebene für KI.", footerLegal: "Rechtliches", footerBottomNote: "Für klare, begrenzte Ausführung entwickelt.", footerSocialNote: "Offizielle Links folgen nach Verifizierung.", legendTitle: "Statuslegende", legendAvailable: "Lokal implementiert und verifiziert", legendDev: "Aktive Architektur- und Vertragsarbeit", legendPlanned: "Geplanter Pfad; noch nicht aktiviert", notFoundTitle: "Diese Ausführungsroute existiert nicht.", notFoundDesc: "Der angeforderte Pfad ist nicht Teil der ExportFlow-Website oder -API.", returnHome: "Zur Startseite", placeholder: "Diese Seite ist ein strukturierter Ausgangspunkt. Details folgen mit verfügbaren Funktionen.", contactIntro: "Erreiche das passende Team. Das Absenden bereitet einen E-Mail-Entwurf in deinem Mailprogramm vor.", formName: "Name", formEmail: "E-Mail", formSubject: "Betreff", formMessage: "Nachricht", send: "Nachricht vorbereiten", consent: "Deine Angaben werden nur zur Beantwortung dieser Anfrage verwendet.", legalReview: "Vor Veröffentlichung prüfen: Rechtsträger, Gerichtsstand, Kontaktdaten und verbindliche Bedingungen.", locale: "Sprache", exploreDocs: "Entwicklerressourcen entdecken" },
  pt: { product: "Produto", platform: "Plataforma", useCases: "Casos de uso", demo: "Prévia", solutions: "Soluções", developers: "Desenvolvedores", pricing: "Preços", resources: "Recursos", about: "Sobre", contact: "Contato", signIn: "Entrar", start: "Começar", eyebrow: "INFRAESTRUTURA DE EXECUÇÃO PARA AGENTES", hero: "Dê à IA o poder de executar.", lead: "Da inteligência web à automação de navegador, o ExportFlow ajuda agentes de IA a transformar planos complexos em resultados verificáveis.", explore: "Explorar a plataforma", available: "Disponível localmente", development: "Em desenvolvimento", planned: "Planejado", capabilities: "Execução com limites claros.", capabilitiesLead: "Uma distinção clara entre o que está disponível e o que está sendo desenvolvido.", how: "Da intenção à evidência.", steps: ["A IA define a tarefa.", "O ExportFlow valida e coordena a execução.", "Mecanismos especializados realizam operações permitidas.", "Os resultados são coletados e validados.", "Resultados estruturados e evidências são retornados."], developersTitle: "Feito para desenvolvedores. Projetado para agentes.", developersLead: "Uma base orientada a contratos para integrações previsíveis e resultados estruturados.", illustrative: "Exemplo ilustrativo · não é um contrato de API ativo", trust: "Projetado para execução controlada.", trustLead: "Infraestrutura confiável começa com limites explícitos e resultados transparentes.", finalTitle: "Além do raciocínio. Parta para a execução.", finalCta: "Comece a criar com ExportFlow", learn: "Saiba mais", footer: "A camada de execução para IA.", footerLegal: "Legal", footerBottomNote: "Construído para execução clara e limitada.", footerSocialNote: "Links oficiais serão publicados após verificação.", legendTitle: "Legenda de status", legendAvailable: "Implementado e verificado localmente", legendDev: "Arquitetura e contrato ativos", legendPlanned: "Caminho planejado; ainda não ativo", notFoundTitle: "Esta rota de execução não existe.", notFoundDesc: "O caminho solicitado não faz parte do site ou da API do ExportFlow.", returnHome: "Voltar ao início", placeholder: "Esta página é uma base estruturada. Os detalhes serão atualizados conforme os recursos estiverem disponíveis.", contactIntro: "Fale com a equipe certa. O envio prepara um rascunho de e-mail no seu cliente padrão.", formName: "Nome", formEmail: "E-mail", formSubject: "Assunto", formMessage: "Mensagem", send: "Preparar mensagem", consent: "Seus dados serão usados apenas para responder a esta solicitação.", legalReview: "Revisão necessária antes da publicação: entidade legal, jurisdição, contato e termos.", locale: "Idioma", exploreDocs: "Explorar recursos para desenvolvedores" },
  ar: { product: "المنتج", platform: "المنصة", useCases: "حالات الاستخدام", demo: "معاينة تفاعلية", solutions: "الحلول", developers: "للمطورين", pricing: "الأسعار", resources: "الموارد", about: "من نحن", contact: "اتصل بنا", signIn: "تسجيل الدخول", start: "ابدأ الآن", eyebrow: "بنية تنفيذ الوكلاء", hero: "امنح الذكاء الاصطناعي القدرة على التنفيذ.", lead: "من ذكاء الويب إلى أتمتة المتصفح، توفر ExportFlow بنية تنفيذ تساعد وكلاء الذكاء الاصطناعي على تحويل الخطط المعقدة إلى نتائج قابلة للتحقق.", explore: "استكشف المنصة", available: "متاح محليًا", development: "قيد التطوير", planned: "مخطط له", capabilities: "تنفيذ ضمن حدود واضحة.", capabilitiesLead: "تمييز واضح بين ما يعمل اليوم وما لا يزال قيد التطوير.", how: "من النية إلى الدليل.", steps: ["يحدد الذكاء الاصطناعي المهمة.", "تتحقق ExportFlow من التنفيذ وتنسقه.", "تنفذ المحركات المتخصصة العمليات المسموح بها.", "تُجمع النتائج ويُتحقق منها.", "تُعاد المخرجات المنظمة والأدلة."], developersTitle: "مصممة للمطورين. ومهيأة للوكلاء.", developersLead: "أساس قائم على العقود لتكاملات متوقعة ونتائج منظمة.", illustrative: "مثال توضيحي · ليس عقد API فعليًا", trust: "مصممة لتنفيذ منضبط.", trustLead: "تبدأ البنية الموثوقة بحدود واضحة ونتائج شفافة.", finalTitle: "تجاوز التفكير إلى التنفيذ.", finalCta: "ابدأ البناء مع ExportFlow", learn: "اعرف المزيد", footer: "طبقة التنفيذ للذكاء الاصطناعي.", footerLegal: "قانوني", footerBottomNote: "مصممة لتنفيذ واضح ومنضبط الحدود.", footerSocialNote: "تُنشر الروابط الرسمية عند التحقق منها.", legendTitle: "دليل الحالات", legendAvailable: "منفذ ومُتحقق منه في البيئة المحلية", legendDev: "عمل نشط على البنية والعقود", legendPlanned: "مسار مصمم ولم يُفعّل بعد", notFoundTitle: "مسار التنفيذ هذا غير موجود.", notFoundDesc: "المسار المطلوب ليس جزءًا من موقع ExportFlow أو واجهة برمجة التطبيقات.", returnHome: "العودة للرئيسية", placeholder: "هذه الصفحة نقطة انطلاق منظمة. ستُحدّث التفاصيل مع توفر الإمكانات.", contactIntro: "تواصل مع الفريق المناسب. يجهز الإرسال مسودة بريد إلكتروني في تطبيق البريد لديك.", formName: "الاسم", formEmail: "البريد الإلكتروني", formSubject: "الموضوع", formMessage: "الرسالة", send: "إعداد الرسالة", consent: "ستُستخدم بياناتك فقط للرد على هذا الاستفسار.", legalReview: "يلزم التحقق قبل النشر: الكيان القانوني والاختصاص وبيانات الاتصال والشروط.", locale: "اللغة", exploreDocs: "استكشف موارد المطورين" },
  zh: { product: "产品", platform: "平台", useCases: "使用场景", demo: "交互预览", solutions: "解决方案", developers: "开发者", pricing: "定价", resources: "资源", about: "关于", contact: "联系", signIn: "登录", start: "开始使用", eyebrow: "智能体执行基础设施", hero: "赋予 AI 执行的能力。", lead: "从网络智能到浏览器自动化，ExportFlow 提供执行基础设施，帮助 AI 智能体将复杂计划转化为可验证的结果。", explore: "探索平台", available: "本地可用", development: "开发中", planned: "计划中", capabilities: "有边界的执行。", capabilitiesLead: "清晰区分当前可用能力与正在开发的功能。", how: "从意图到证据。", steps: ["AI 定义任务。", "ExportFlow 验证并协调执行。", "专用引擎执行获准的操作。", "收集并验证结果。", "返回结构化输出和证据。"], developersTitle: "为开发者构建，为智能体设计。", developersLead: "以契约为先，为可预测集成、结构化结果和可观察执行提供基础。", illustrative: "示意示例 · 非实际 API 契约", trust: "为受控执行而设计。", trustLead: "可靠基础设施始于明确边界与透明结果。", finalTitle: "超越 AI 推理，迈向执行。", finalCta: "开始构建 ExportFlow", learn: "了解更多", footer: "AI 的执行层。", footerLegal: "法律条款", footerBottomNote: "专为清晰、有边界的执行而构建。", footerSocialNote: "官方链接将在核验后公布。", legendTitle: "状态说明", legendAvailable: "已在本地运行时实现并验证", legendDev: "正在进行架构与契约开发", legendPlanned: "已规划路径，尚未启用", notFoundTitle: "该执行路由不存在。", notFoundDesc: "请求的路径不属于 ExportFlow 站点或 API 表面。", returnHome: "返回首页", placeholder: "此页面为结构化起点，功能可用后将更新详细信息。", contactIntro: "联系合适的团队。提交后会在本地邮件客户端中生成预填草稿。", formName: "姓名", formEmail: "邮箱", formSubject: "主题", formMessage: "信息", send: "准备信息", consent: "您的信息仅用于回复此咨询。", legalReview: "发布前需审核：法律实体、司法管辖区、联系方式及约束性条款。", locale: "语言", exploreDocs: "浏览开发者资源" },
  ja: { product: "プロダクト", platform: "プラットフォーム", useCases: "ユースケース", demo: "プレビュー", solutions: "ソリューション", developers: "開発者", pricing: "料金", resources: "リソース", about: "会社概要", contact: "お問い合わせ", signIn: "サインイン", start: "始める", eyebrow: "AIエージェント実行基盤", hero: "AIに実行する力を。", lead: "Webインテリジェンスからブラウザー自動化まで、ExportFlowはAIエージェントが複雑な計画を検証可能な結果へ変える実行基盤を提供します。", explore: "プラットフォームを見る", available: "ローカルで利用可能", development: "開発中", planned: "計画中", capabilities: "境界のある実行。", capabilitiesLead: "現在利用可能な機能と開発中の機能を明確に区別します。", how: "意図から証拠まで。", steps: ["AIがタスクを定義します。", "ExportFlowが検証し実行を調整します。", "専用エンジンが許可された操作を行います。", "結果を収集して検証します。", "構造化された出力と証拠を返します。"], developersTitle: "開発者のために構築し、エージェントのために設計。", developersLead: "予測可能な統合、構造化された結果、可観測な実行のための契約中心の基盤です。", illustrative: "参考例 · 実際のAPI契約ではありません", trust: "制御された実行のために設計。", trustLead: "信頼できる基盤は明確な境界と透明な結果から始まります。", finalTitle: "AIの推論を超えて、実行へ。", finalCta: "ExportFlowで開発を始める", learn: "詳しく見る", footer: "AIの実行レイヤー。", footerLegal: "法的情報", footerBottomNote: "明確で境界のある実行のために構築。", footerSocialNote: "公式リンクは確認後に公開します。", legendTitle: "ステータス凡例", legendAvailable: "ローカル環境で実装・検証済み", legendDev: "アーキテクチャおよび契約を開発中", legendPlanned: "設計済みパス（未有効化）", notFoundTitle: "この実行ルートは存在しません。", notFoundDesc: "リクエストされたパスは ExportFlow サイトまたは API にはありません。", returnHome: "ホームに戻る", placeholder: "このページは構造化された出発点です。機能の提供状況に応じて詳細を更新します。", contactIntro: "適切なチームへお問い合わせください。送信するとメールアプリに下書きが作成されます。", formName: "氏名", formEmail: "メールアドレス", formSubject: "件名", formMessage: "メッセージ", send: "メッセージを準備", consent: "入力情報はお問い合わせへの返信にのみ使用します。", legalReview: "公開前に確認: 法人、管轄、連絡先、法的拘束力のある条件。", locale: "言語", exploreDocs: "開発者向けリソースを見る" },
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
  ["/faq", "Frequently Asked Questions", "Answers about ExportFlow capabilities, security boundaries, and current product status.", "faq"],
  ["/legal/terms", "Terms of Service", "Terms and conditions for use of ExportFlow."],
  ["/legal/privacy", "Privacy Policy", "How information is handled when using ExportFlow."],
  ["/legal/cookies", "Cookie Policy", "Information about cookies and similar technologies."],
  ["/legal/refund-policy", "Refund Policy", "Refund information will be provided when applicable plans are finalized."],
  ["/legal/acceptable-use", "Acceptable Use", "Responsible use principles for ExportFlow."],
  ["/legal/security", "Security", "Security practices and responsible disclosure information."],
  ...AUTH_ROUTES,
];

const UNIFIED_NON_SITEMAP_ROUTES = [
  ["/platform", "Platform Architecture", "Seven execution layers from Agent Interface to bounded Evidence & Provenance.", "platform"],
  ["/use-cases", "Use Cases & Workflows", "Five bounded agent workflows showing problem solved, agent role, and ExportFlow boundary.", "use-cases"],
  ["/demo", "Bounded Execution Preview", "Interactive browser simulation of the ExportFlow task contract, egress guard, and evidence envelope.", "demo"],
];

function hrefFor(path, locale) {
  return locale === "en" ? path : `/${locale}${path === "/" ? "" : path}`;
}

function statusFor(key, t) {
  return key === "available" ? t.available : key === "development" ? t.development : t.planned;
}

function statusBadgeHtml(state, t) {
  const variant = state === "available" ? "available" : state === "development" ? "dev" : "planned";
  return `<span class="ef-badge ef-badge-${variant}"><span>${escapeHtml(statusFor(state, t))}</span></span>`;
}

function arrowRightIcon(cls = "ef-icon ef-icon-sm ef-btn-arrow ef-dir-arrow") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
}

function arrowUpRightIcon(cls = "ef-icon ef-icon-sm ef-btn-arrow ef-dir-arrow") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

function logo(locale = "en") {
  return `<a class="ef-brand ef-brand-new" href="${hrefFor("/", locale)}" aria-label="ExportFlow home">
    <span class="ef-mark ef-mark-cat" aria-hidden="true">
      ${renderBrandCatSvg("ef-brand-cat-svg")}
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

function themeToggleButton(ld) {
  const label = ld?.themeAriaLight || "Switch to dark theme";
  return `<button type="button" class="ef-icon-btn" data-theme-toggle aria-pressed="false" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
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
  const at = getAuthCopy(locale);
  const ld = getLocaleData(locale);
  const nav = [
    ["/product", t.product],
    ["/platform", t.platform],
    ["/developers", t.developers],
    ["/demo", t.demo],
    ["/pricing", t.pricing],
  ];

  const drawerNav = [
    ["/product", t.product],
    ["/platform", t.platform],
    ["/use-cases", t.useCases],
    ["/solutions", t.solutions],
    ["/developers", t.developers],
    ["/demo", t.demo],
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
        ${themeToggleButton(ld)}
        <a class="ef-signin-link ef-workspace-nav-link" href="${hrefFor("/workspace", locale)}" data-auth-workspace-link hidden${path === "/workspace" ? ` aria-current="page"` : ""}>${escapeHtml(at.workspaceNavLabel)}</a>
        <a class="ef-signin-link" href="${hrefFor("/signin", locale)}" data-auth-header-link data-signin-href="${hrefFor("/signin", locale)}" data-account-href="${hrefFor("/account", locale)}" data-signin-label="${escapeHtml(t.signIn)}"${path === "/signin" || path === "/account" ? ` aria-current="page"` : ""}>${escapeHtml(t.signIn)}</a>
        <button type="button" class="ef-code-btn ef-header-signout" data-auth-header-signout hidden>${escapeHtml(at.signOut)}</button>
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
      ${drawerNav.map(([href, label]) => `<a href="${hrefFor(href, locale)}"${path === href ? ` aria-current="page"` : ""}><span>${escapeHtml(label)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>`).join("")}
      <a href="${hrefFor("/workspace", locale)}" data-auth-drawer-workspace hidden${path === "/workspace" ? ` aria-current="page"` : ""}><span>${escapeHtml(at.workspaceNavLabel)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
      <a href="${hrefFor("/signin", locale)}" data-auth-drawer-signin${path === "/signin" ? ` aria-current="page"` : ""}><span>${escapeHtml(t.signIn)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
      <a href="${hrefFor("/account", locale)}" data-auth-drawer-account${path === "/account" ? ` aria-current="page"` : ""}><span>${escapeHtml(at.accountNavLabel)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
      <a href="${hrefFor("/contact", locale)}"${path === "/contact" ? ` aria-current="page"` : ""}><span>${escapeHtml(t.contact)}</span>${arrowRightIcon("ef-icon ef-icon-sm ef-dir-arrow")}</a>
    </nav>
    <div class="ef-drawer-actions">
      <button type="button" class="ef-btn ef-btn-secondary" data-auth-drawer-signout hidden>
        <span>${escapeHtml(at.signOut)}</span>
      </button>
      <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
        <span>${escapeHtml(t.start)}</span>
        ${arrowUpRightIcon()}
      </a>
      <a class="ef-btn ef-btn-secondary" href="${hrefFor("/demo", locale)}">
        <span>${escapeHtml(t.demo)}</span>
      </a>
    </div>
  </aside>`;
}

function footer(locale, t) {
  const at = getAuthCopy(locale);
  const ld = getLocaleData(locale);
  const groups = [
    [t.platform, [["/product", t.product], ["/platform", t.platform], ["/use-cases", t.useCases], ["/solutions", t.solutions], ["/pricing", t.pricing]]],
    [t.developers, [["/developers", t.developers], ["/demo", t.demo], ["/workspace", at.workspaceNavLabel], ["/docs", ld.footerDocs], ["/integrations", ld.footerIntegrations]]],
    [t.resources, [["/about", t.about], ["/faq", ld.footerFaq], ["/blog", ld.footerBlog], ["/contact", t.contact], ["/signin", t.signIn], ["/account", at.accountNavLabel]]],
    [t.footerLegal, [["/legal/terms", ld.footerTerms], ["/legal/privacy", ld.footerPrivacy], ["/legal/cookies", ld.footerCookies], ["/legal/security", ld.footerSecurity]]],
  ];

  return `<footer class="ef-footer ef-footer-new">
    <div class="ef-container">
      <div class="ef-footer-grid">
        <div>
          ${logo(locale)}
          <p class="ef-footer-brand-desc">${escapeHtml(t.footer)}<br>${escapeHtml(ld.tagline)}</p>
          <div class="ef-footer-controls">
            ${languageSwitcherHtml(locale, t, "footer")}
            ${themeToggleButton(ld)}
            <button type="button" class="ef-cmd-trigger" data-cmd-open aria-label="${escapeHtml(ld.quickJumpAria)}">
              <span>${escapeHtml(ld.quickJump)}</span>
              <kbd dir="ltr">⌘K</kbd>
            </button>
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
        <span>${escapeHtml(t.footerBottomNote)}</span>
        <span>${escapeHtml(t.footerSocialNote)}</span>
      </div>
    </div>
  </footer>
  <div class="ef-cmd-backdrop" data-cmd-backdrop hidden>
    <div class="ef-cmd-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(ld.quickJump)}">
      <div class="ef-cmd-head">
        <input type="search" class="ef-cmd-input" data-cmd-input placeholder="${escapeHtml(ld.quickJumpPlaceholder)}">
        <button type="button" class="ef-code-btn" data-cmd-close>${escapeHtml(ld.closeLabel)}</button>
      </div>
      <ul class="ef-cmd-list" data-cmd-list role="listbox">
        ${[
          ["/", ld.homeLabel],
          ["/platform", t.platform],
          ["/use-cases", t.useCases],
          ["/developers", t.developers],
          ["/demo", t.demo],
          ["/workspace", at.workspaceNavLabel],
          ["/account", at.accountNavLabel],
          ["/signin", t.signIn],
        ].map(([p, lbl], idx) => `<li role="none"><a class="ef-cmd-item${idx === 0 ? " is-selected" : ""}" role="option" href="${hrefFor(p, locale)}" data-cmd-item><span>${escapeHtml(lbl)}</span><code dir="ltr">${escapeHtml(hrefFor(p, locale))}</code></a></li>`).join("")}
      </ul>
    </div>
  </div>`;
}

function homeBody(t, locale) {
  const ld = getLocaleData(locale);
  const { cards, featuredSpecs, stepSpecs, trustPoints } = ld;
  const featuredCard = cards[0];
  const secondaryCards = cards.slice(1);

  return `
  <!-- HERO: Cupertino Centered Keynote Framing + Hardware Execution Stage -->
  <section class="ef-hero" data-hero-section>
    <div class="ef-container ef-hero-editorial">
      <h1 class="ef-hero-title ef-hero-stagger ef-stagger-2">${escapeHtml(t.hero)}</h1>
      <p class="ef-hero-lead ef-hero-stagger ef-stagger-3">${escapeHtml(t.lead)}</p>

      <div class="ef-hero-actions ef-hero-stagger ef-stagger-4">
        <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
          <span>${escapeHtml(t.start)}</span>
        </a>
        <a class="ef-text-link" href="${hrefFor("/platform", locale)}">
          <span>${escapeHtml(t.explore)}</span>
          ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
        </a>
      </div>

      <div class="ef-hero-meta ef-hero-stagger ef-stagger-5">
        <span>${escapeHtml(t.available)} · ${escapeHtml(ld.heroBadgeSuffix)}</span>
        <span aria-hidden="true">·</span>
        <button type="button" class="ef-motion-toggle" data-motion-toggle aria-pressed="false">
          <span data-motion-label>${escapeHtml(ld.pauseMotion)}</span>
        </button>
      </div>
    </div>

    <div class="ef-container ef-hero-stage ef-hero-stagger ef-stagger-5">
      ${renderExecutionGraph({
        availableLabel: t.available,
        developmentLabel: t.development,
        plannedLabel: t.planned,
        locale,
      })}
    </div>
  </section>

  <!-- 01 PLATFORM CAPABILITIES: Featured Spec Showcase + Hairline Architectural Matrix -->
  <section class="ef-section ef-section-tinted" aria-labelledby="cap-heading">
    <div class="ef-container">
      <div class="ef-section-head-split ef-reveal" data-reveal>
        <div class="ef-section-head">
          <div class="ef-section-title-row">
            
            <h2 id="cap-heading" class="ef-section-title">${escapeHtml(t.capabilities)}</h2>
          </div>
          <p class="ef-section-lead">${escapeHtml(t.capabilitiesLead)}</p>
        </div>

        <div class="ef-cap-filter-bar" role="group" aria-label="${escapeHtml(t.capabilities)}">
          <button type="button" class="ef-filter-pill" data-cap-filter="all" aria-pressed="true">${escapeHtml(ld.allFilter)}</button>
          <button type="button" class="ef-filter-pill" data-cap-filter="available" aria-pressed="false">${escapeHtml(t.available)}</button>
          <button type="button" class="ef-filter-pill" data-cap-filter="development" aria-pressed="false">${escapeHtml(t.development)}</button>
          <button type="button" class="ef-filter-pill" data-cap-filter="planned" aria-pressed="false">${escapeHtml(t.planned)}</button>
        </div>
      </div>

      <div class="ef-cap-showcase" data-cap-grid>
        <a class="ef-cap-card ef-cap-card-featured ef-reveal" href="${hrefFor(featuredCard[4], locale)}" data-cap-card data-cap-state="${featuredCard[3]}" data-reveal data-glow-card>
          <div class="ef-cap-featured-copy">
            <div class="ef-cap-status-row">
              ${statusBadgeHtml(featuredCard[3], t)}
            </div>
            <div class="ef-title-icon-row">
              ${renderFeatureIcon(featuredCard[6])}
              <h3>${escapeHtml(featuredCard[1])}</h3>
            </div>
            <p>${escapeHtml(featuredCard[2])}</p>
            <span class="ef-text-link">
              <span>${escapeHtml(t.learn)}</span>
              ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
            </span>
          </div>
          <dl class="ef-spec-strip" aria-label="${escapeHtml(featuredCard[1])}">
            ${featuredSpecs.map(([num, unit, label]) => `<div><dt>${escapeHtml(label)}</dt><dd class="ef-spec-value"><span class="ef-spec-num">${escapeHtml(num)}</span><span class="ef-spec-unit">${escapeHtml(unit)}</span></dd></div>`).join("")}
          </dl>
        </a>

        <div class="ef-cap-grid">
          ${secondaryCards.map(([_num, title, desc, state, href, meta, iconName], i) => {
            const isPlanned = state === "planned";
            const cardClasses = ["ef-cap-card", "ef-reveal", isPlanned ? "ef-cap-card-planned" : ""].filter(Boolean).join(" ");
            return `<a class="${cardClasses}" href="${hrefFor(href, locale)}" data-cap-card data-cap-state="${state}" data-reveal data-reveal-delay="${i * 50}" data-glow-card>
              <div class="ef-cap-status-row">
                ${statusBadgeHtml(state, t)}
              </div>
              <div class="ef-title-icon-row">
                ${renderFeatureIcon(iconName)}
                <h3>${escapeHtml(title)}</h3>
              </div>
              <p>${escapeHtml(desc)}</p>
              <p class="ef-cap-meta-inline">${meta.map((m) => escapeHtml(m)).join(" · ")}</p>
              <span class="ef-cap-link">
                <span>${escapeHtml(t.learn)}</span>
                ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
              </span>
            </a>`;
          }).join("")}
        </div>
      </div>

      <div class="ef-status-legend ef-reveal" data-reveal role="note" aria-label="${escapeHtml(t.legendTitle)}">
        <span class="ef-legend-title">${escapeHtml(t.legendTitle)}</span>
        <ul class="ef-legend-items">
          <li>${statusBadgeHtml("available", t)} <span>${escapeHtml(t.legendAvailable)}</span></li>
          <li>${statusBadgeHtml("development", t)} <span>${escapeHtml(t.legendDev)}</span></li>
          <li>${statusBadgeHtml("planned", t)} <span>${escapeHtml(t.legendPlanned)}</span></li>
        </ul>
      </div>
    </div>
  </section>

  <!-- 02 EXECUTION MODEL: Full-Bleed Obsidian Keynote Section -->
  <section class="ef-section ef-section-obsidian" aria-labelledby="exec-heading">
    <div class="ef-container">
      <div class="ef-section-head ef-reveal" data-reveal>
        <div class="ef-section-title-row">
          
          <h2 id="exec-heading" class="ef-section-title">${escapeHtml(t.how)}</h2>
        </div>
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
            <div class="ef-step-insp-left">
              ${stepSpecs.map((s, idx) => `<span data-step-insp-icon="${idx}"${idx === 0 ? "" : " hidden"}>${renderFeatureIcon(s.icon)}</span>`).join("")}
              <span class="ef-step-insp-idx" data-step-insp-idx>${escapeHtml(`${ld.stepPrefix} 01`)}</span>
            </div>
            <span class="ef-step-insp-badge">${escapeHtml(ld.pipelineStage)}</span>
          </div>
          <h3 class="ef-step-insp-title" data-step-insp-title>${escapeHtml(stepSpecs[0].phase)}</h3>
          <p class="ef-step-insp-desc" data-step-insp-desc>${escapeHtml(stepSpecs[0].summary)}</p>
          <dl class="ef-step-insp-dl">
            <div>
              <dt>${escapeHtml(ld.coreModule)}</dt>
              <dd data-step-insp-module>${escapeHtml(stepSpecs[0].module)}</dd>
            </div>
            <div>
              <dt>${escapeHtml(ld.enforcedGuardrails)}</dt>
              <dd data-step-insp-guard>${escapeHtml(stepSpecs[0].guard)}</dd>
            </div>
          </dl>
          <div class="ef-step-insp-foot">
            <a class="ef-cap-link" href="${hrefFor("/demo", locale)}">
              <span>${escapeHtml(ld.inspectPreview)}</span>
              ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
            </a>
          </div>
          <script type="application/json" data-step-meta>${JSON.stringify(stepSpecs).replaceAll("<", "\\u003c")}</script>
        </aside>
      </div>
    </div>
  </section>

  <!-- 03 DEVELOPER FIRST: Luminous Xcode Document Sheet -->
  <section class="ef-section" aria-labelledby="dev-heading">
    <div class="ef-container ef-dev-grid">
      <div class="ef-reveal" data-reveal>
        <div class="ef-section-title-row">
          
          <h2 id="dev-heading" class="ef-section-title">${escapeHtml(t.developersTitle)}</h2>
        </div>
        <p class="ef-section-lead">${escapeHtml(t.developersLead)}</p>
        <div class="ef-dev-actions">
          <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
            <span>${escapeHtml(t.exploreDocs)}</span>
          </a>
          <a class="ef-text-link" href="${hrefFor("/demo", locale)}">
            <span>${escapeHtml(ld.browserPreview)}</span>
            ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
          </a>
        </div>
      </div>

      <div class="ef-code-card ef-reveal" data-reveal data-typewriter-card>
        <div class="ef-code-head">
          <div class="ef-code-tabs" role="tablist" aria-label="${escapeHtml(t.illustrative)}">
            <button type="button" class="ef-code-tab" role="tab" data-code-tab="request" aria-selected="true">task.contract.example.json</button>
            <button type="button" class="ef-code-tab" role="tab" data-code-tab="response" aria-selected="false">result.200.json</button>
            <button type="button" class="ef-code-tab" role="tab" data-code-tab="guard" aria-selected="false">guard.501.json</button>
          </div>
          <div class="ef-code-tools">
            <button type="button" class="ef-code-btn" data-typewriter-replay aria-label="${escapeHtml(ld.runLabel)}">
              <span>${escapeHtml(ld.runLabel)}</span>
            </button>
            <button type="button" class="ef-code-btn" data-copy-code aria-label="${escapeHtml(ld.copyLabel)}">
              <svg data-icon-copy class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <svg data-icon-check class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><polyline points="20 6 9 17 4 12"/></svg>
              <span data-copy-label>${escapeHtml(ld.copyLabel)}</span>
            </button>
          </div>
        </div>

        <pre class="ef-code-pre"><code><span data-typewriter-target></span><span class="ef-type-cursor" data-type-cursor aria-hidden="true"></span></code></pre>

        <div class="ef-code-result" data-typewriter-result aria-live="polite">
          <div class="ef-code-result-bar">
            <span class="ef-code-result-status" data-code-status>
              <span>${escapeHtml(ld.codeInitialStatus)}</span>
            </span>
            <span class="ef-code-result-note" data-code-adapter>${escapeHtml(ld.codeInitialAdapter)}</span>
          </div>
        </div>

        <div class="ef-code-foot">
          <span>${escapeHtml(t.illustrative)}</span>
          <span>${escapeHtml(ld.jsonLabel)}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- 04 TRUST BY DESIGN: Pure Apple Editorial Hairline Matrix -->
  <section class="ef-section ef-section-tinted" aria-labelledby="trust-heading">
    <div class="ef-container">
      <div class="ef-section-head ef-reveal" data-reveal>
        <div class="ef-section-title-row">
          
          <h2 id="trust-heading" class="ef-section-title">${escapeHtml(t.trust)}</h2>
        </div>
        <p class="ef-section-lead">${escapeHtml(t.trustLead)}</p>
      </div>

      <ul class="ef-trust-list ef-reveal" data-reveal data-trust-list>
        ${trustPoints.map(([label, desc, iconName]) => `<li class="ef-trust-item">
          <div class="ef-trust-item-head">
            ${renderFeatureIcon(iconName)}
            <strong>${escapeHtml(label)}</strong>
          </div>
          <p>${escapeHtml(desc)}</p>
        </li>`).join("")}
      </ul>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="ef-final-cta" aria-labelledby="final-cta-heading">
    <div class="ef-container ef-reveal" data-reveal>
      <h2 id="final-cta-heading">${escapeHtml(t.finalTitle)}</h2>
      <div class="ef-hero-actions">
        <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}">
          <span>${escapeHtml(t.finalCta)}</span>
        </a>
        <a class="ef-text-link" href="${hrefFor("/demo", locale)}">
          <span>${escapeHtml(t.demo)}</span>
          ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
        </a>
      </div>
    </div>
  </section>

  <!-- MOBILE THUMB-SAFE CTA BAR -->
  <div class="ef-mobile-sticky-cta" aria-hidden="true" inert>
    <span>${escapeHtml(ld.mobileStickyStatus)}</span>
    <a class="ef-btn ef-btn-primary ef-btn-sm" href="${hrefFor("/developers", locale)}">
      <span>${escapeHtml(t.start)}</span>
    </a>
  </div>`;
}

function genericBody(route, path, t, locale, oauthDetails = {}) {
  const [url, title, description, type] = route;
  const isLegal = path.startsWith("/legal/");
  const isAr = locale === "ar";
  const ld = getLocaleData(locale);

  if (type && type.startsWith("auth-")) {
    return renderAuthPage(type, t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, oauthDetails);
  }

  if (type === "faq") {
    const faqKicker = isAr ? "الأسئلة الشائعة" : ld.footerFaq;
    const faqTitle = isAr ? "الأسئلة الشائعة" : title;
    const faqLead = isAr
      ? "إجابات واضحة حول قدرات ExportFlow وحدود الأمان وحالة التطوير الحالية."
      : description;
    const questions = isAr
      ? [
          ["ما هي منصة ExportFlow؟", "ExportFlow بنية تنفيذ للويب مستقلة عن المزود؛ تفصل منطق الوكيل الذكي عن التنفيذ المنضبط على الويب وتطبيق السياسات وإرجاع النتائج المهيكلة مع سجل الأدلة."],
          ["ما القدرات المفعلة حالياً؟", "عقد REST Task contract العام مقصور حالياً على جلب HTTP المحدود (http.fetch.v1). قدرات البحث والأتمتة بالمتصفح لم تُفعل بعد على النقاط العامة."],
          ["هل تتجاوز المنصة تسجيل الدخول أو الحمايات؟", "لا. المنصة مصممة للموارد العامة المتاحة عبر HTTP(S) ولا تتجاوز المصادقة أو الجدران المدفوعة أو اختبارات CAPTCHA."],
          ["هل تعتمد ExportFlow على مزود نموذج ذكاء اصطناعي واحد؟", "لا. عقد التنفيذ محايد تماماً عن النماذج؛ يرسل الوكيل النية والحدود فتتولى النواة التحقق والتوجيه وإرجاع النتائج."],
          ["هل أتمتة المتصفح متاحة اليوم؟", "لا. مسار المتصفح يتطلب بيئة متصفح معزولة ومراجعة أمنية مستقلة، ويعيد 501 حالياً حتى يتم ربطه."],
          ["هل ExportFlow جاهزة للإنتاج الكامل؟", "المشروع في مرحلة بناء ومعاينة محكومة، ولا تضمن الاختبارات المحلية الجاهزية الإنتاجية المفتوحة."],
          ["أين يطلع المطورون على العقد الحالي؟", "ابدأ بصفحة المطورين واستخدم لوحة التجربة التفاعلية للتحقق من قواعد العقد والأدلة."],
        ]
      : [
          ["What is ExportFlow?", "ExportFlow is model-agnostic agentic web infrastructure. It separates an AI agent's reasoning from bounded web execution, policy enforcement, normalized results, and source evidence."],
          ["Which capabilities are currently enabled?", "The public REST Task contract is intentionally limited to bounded HTTP Fetch. Search, Research, and Browser execution are not generally enabled. Map, Crawl, and structured extraction have internal or preview implementations, but their presence in the repository does not make them production services."],
          ["Can ExportFlow interact with logged-in websites or bypass protections?", "No. The platform is designed for eligible public HTTP(S) resources. It does not bypass authentication, paywalls, CAPTCHAs, or anti-bot controls, and it must enforce destination and redirect restrictions."],
          ["Does ExportFlow depend on one AI model provider?", "No. The execution contract is model-agnostic. Agents supply task intent through the documented interface; the Core validates the request, applies policy, routes supported work, and returns normalized output with provenance."],
          ["Is browser automation available today?", "No. Browser rendering requires a separately configured browser runtime and security acceptance. User-directed browser interactions remain unsupported until an explicitly reviewed implementation is available."],
          ["Is ExportFlow ready for production customers?", "The project is still in a controlled development and preview phase. Local tests and Worker dry-runs are not a production availability guarantee. Customer onboarding, durable task operations, and production enablement require separate verification."],
          ["Where can developers see the current contract?", "Start with the Developers page and API Reference. Treat illustrative examples as examples only; verify the live capability response and published API contract before integrating."],
        ];
    return `<section class="ef-page-hero">
      <div class="ef-container">
        <div class="ef-section-title-row">
          
          <h1>${escapeHtml(faqTitle)}</h1>
        </div>
        <p class="ef-page-lead">${escapeHtml(faqLead)}</p>
      </div>
    </section>
    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-faq-list" aria-label="${isAr ? "الأسئلة الشائعة" : "Frequently asked questions"}">
          ${questions.map(([question, answer], index) => `<details class="ef-info-card ef-faq-item" data-faq-item${index === 0 ? " open" : ""}>
            <summary class="ef-faq-summary">${escapeHtml(question)}</summary>
            <div class="ef-faq-answer"><p>${escapeHtml(answer)}</p></div>
          </details>`).join("")}
        </div>
      </div>
    </section>`;
  }

  if (type === "contact") {
    const channels = isAr
      ? [
          ["الاستفسارات العامة", "أسئلة عامة حول المنتج والشركة."],
          ["الدعم الفني", "مساعدة في الإعداد المحلي والمشاكل التقنية."],
          ["استفسارات المطورين", "التوثيق وواجهات API ومفاهيم التكامل."],
          ["استفسارات الأعمال", "مناقشات الشراكات والأعمال."],
        ]
      : [
          ["General inquiries", "General product and company questions."],
          ["Technical support", "Help with local setup and technical issues."],
          ["Developer inquiries", "Documentation, APIs, and integration concepts."],
          ["Business inquiries", "Business and partnership discussions."],
        ];
    return `<section class="ef-page-hero">
      <div class="ef-container">
        <div class="ef-section-title-row">
          
          <h1>${escapeHtml(isAr ? t.contact : title)}</h1>
        </div>
        <p class="ef-page-lead">${escapeHtml(t.contactIntro)}</p>
      </div>
    </section>
    <section class="ef-section">
      <div class="ef-container ef-contact-layout">
        <div>
          <h2 class="ef-section-title">${isAr ? "اختر قناة التواصل" : "Choose a channel"}</h2>
          <div class="ef-channel-list">
            ${channels.map(([a, b]) => `<article class="ef-channel-item">
              <div>
                <h3>${escapeHtml(a)}</h3>
                <p>${escapeHtml(b)}</p>
              </div>
              <span class="ef-badge ef-badge-planned">${isAr ? "قريباً" : "Pending"}</span>
            </article>`).join("")}
          </div>
          <p class="ef-section-lead ef-mt-20 ef-text-sm">${isAr ? "بريد الدعم · بريد الأعمال · GitHub · LinkedIn — ستُضاف الروابط الرسمية فور توثيقها." : "Support email · Business email · GitHub · LinkedIn · X — official links will be added when confirmed."}</p>
        </div>

        <form class="ef-contact-form" data-contact-form novalidate>
          <div class="ef-field">
            <label for="cf-name">${escapeHtml(t.formName)}</label>
            <input id="cf-name" name="name" autocomplete="name" required maxlength="120" aria-describedby="err-name">
            <span id="err-name" class="ef-field-error" data-error-for="name"></span>
          </div>
          <div class="ef-field">
            <label for="cf-email">${escapeHtml(t.formEmail)}</label>
            <input id="cf-email" class="ef-ltr-input" name="email" type="email" autocomplete="email" required maxlength="254" aria-describedby="err-email">
            <span id="err-email" class="ef-field-error" data-error-for="email"></span>
          </div>
          <div class="ef-field">
            <label for="cf-subject">${escapeHtml(t.formSubject)}</label>
            <select id="cf-subject" name="subject" required aria-describedby="err-subject">
              <option value="">${isAr ? "اختر نوع الاستفسار" : "Select an inquiry type"}</option>
              <option>${isAr ? "استفسار عام" : "General inquiry"}</option>
              <option>${isAr ? "دعم فني" : "Technical support"}</option>
              <option>${isAr ? "استفسار مطورين" : "Developer inquiry"}</option>
              <option>${isAr ? "استفسار أعمال" : "Business inquiry"}</option>
            </select>
            <span id="err-subject" class="ef-field-error" data-error-for="subject"></span>
          </div>
          <div class="ef-field">
            <label for="cf-message">${escapeHtml(t.formMessage)}</label>
            <textarea id="cf-message" name="message" rows="5" required maxlength="4000" aria-describedby="err-message"></textarea>
            <span id="err-message" class="ef-field-error" data-error-for="message"></span>
          </div>
          <div>
            <label class="ef-consent">
              <input type="checkbox" name="consent" required aria-describedby="err-consent">
              <span>${escapeHtml(t.consent)}</span>
            </label>
            <span id="err-consent" class="ef-field-error" data-error-for="consent"></span>
          </div>
          <button class="ef-btn ef-btn-primary" type="submit">
            <span>${escapeHtml(t.send)}</span>
            ${arrowRightIcon()}
          </button>
          <p class="ef-form-banner" role="status" data-form-status>${isAr ? "يجهّز مسودة بريد مملوءة في تطبيق البريد الخاص بك." : "Prepares a pre-filled draft in your email client."}</p>
        </form>
      </div>
    </section>`;
  }

  const richContent = renderUnifiedRichRoute(path, route, {
    t,
    locale,
    hrefFor,
    escapeHtml,
    arrowRightIcon,
    arrowUpRightIcon,
    statusBadgeHtml,
  });
  if (richContent) return richContent;

  const badgeState = type === "available" ? "available" : type === "development" || type === "developers" ? "development" : "planned";
  const legalTitleAr = {
    "/legal/terms": "شروط الاستخدام",
    "/legal/privacy": "سياسة الخصوصية",
    "/legal/cookies": "سياسة ملفات الارتباط",
    "/legal/refund-policy": "سياسة الاسترداد",
    "/legal/acceptable-use": "سياسة الاستخدام المقبول",
    "/legal/security": "الأمان والإفصاح المسؤول",
  }[path] || title;
  const displayTitle = isLegal && isAr ? legalTitleAr : title;
  const legalSectionLabels = isAr
    ? ["النطاق", "المعلومات المطلوب تأكيدها", "حالة المنتج", "التواصل وتاريخ السريان"]
    : ["Scope", "Information to confirm", "Product status", "Contact and effective date"];
  const legalSectionIds = ["legal-scope", "legal-information", "legal-status", "legal-contact"];

  const content = isLegal
    ? (isAr
        ? `<div class="ef-legal-review" role="note">${escapeHtml(t.legalReview)}</div>
           <h2 id="legal-scope">1. النطاق</h2>
           <p>توفر هذه الوثيقة هيكلاً جاهزاً للنشر لصفحة «${escapeHtml(displayTitle)}». لا تُعد استشارة قانونية أو التزاماً تعاقدياً ملزماً.</p>
           <h2 id="legal-information">2. البيانات المطلوب تأكيدها</h2>
           <p>يجب تأكيد الكيان القانوني والاختصاص القضائي وممارسات البيانات وفترات الاحتفاظ وقناة الاتصال المعتمدة قبل النشر.</p>
           <h2 id="legal-status">3. حالة المنتج</h2>
           <p>تعكس أوصاف قدرات ExportFlow حالة المنتج المنشورة حالياً دون أي ضمان صريح أو ضمني لمستوى الخدمة.</p>
           <h2 id="legal-contact">4. التواصل وتاريخ السريان</h2>
           <p>تُضاف وسيلة تواصل موثقة وتاريخ سريان بعد المراجعة القانونية المختصة.</p>`
        : `<div class="ef-legal-review" role="note">${escapeHtml(t.legalReview)}</div>
           <h2 id="legal-scope">1. Scope</h2>
           <p>This document provides a publication-ready structure for the ${escapeHtml(title.toLowerCase())}. It is not legal advice and is not a binding statement of terms.</p>
           <h2 id="legal-information">2. Information to confirm</h2>
           <p>Confirm the legal entity, governing jurisdiction, data practices, applicable rights, retention periods, and contact channel before publication.</p>
           <h2 id="legal-status">3. Product status</h2>
           <p>Descriptions of ExportFlow capabilities must reflect the current published product status. No service level, certification, warranty, or availability commitment is implied here.</p>
           <h2 id="legal-contact">4. Contact and effective date</h2>
           <p>Add a verified contact method and effective date after review by qualified counsel.</p>`)
    : `<div class="ef-status-banner">
         ${statusBadgeHtml(badgeState, t)}
         <span>${isAr ? "تُعرض حالة الميزات بشفافية وهي خاضعة للتحديث المستمر." : "Capability status is described conservatively and is subject to change."}</span>
       </div>
       <h2>${isAr ? "ماذا يعني هذا؟" : "What this means"}</h2>
       <p>${escapeHtml(description)}</p>
       <h2>${isAr ? "الأساس الحالي" : "Current foundation"}</h2>
       <p>${isAr ? "يتضمن المستودع محول جلب HTTP موثق محلياً مع حماية SSRF وحدود استجابة وإرفاق الأدلة." : "The repository includes a locally verified, authenticated HTTP Fetch adapter with egress controls, response limits, redirect validation, and source metadata. Production availability is not represented here."}</p>
       <div class="ef-sub-grid">
         <div class="ef-info-card">
           <div class="ef-title-icon-row">${renderFeatureIcon("browser-automation")}<h3>${escapeHtml(ld.browserPreview)}</h3></div>
           <p>${isAr ? "اختبر قواعد التحقق وحواجز الأمان ومخرجات JSON داخل المتصفح." : "Inspect validation rules, egress guards, and normalized JSON envelopes without sending external requests."}</p>
           <p class="ef-mt-12"><a class="ef-cap-link" href="${hrefFor("/demo", locale)}">${escapeHtml(t.demo)} ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
         </div>
         <div class="ef-info-card">
           <div class="ef-title-icon-row">${renderFeatureIcon("developer-platform")}<h3>${escapeHtml(t.developers)}</h3></div>
           <p>${isAr ? "استعرض عقد المهام ومرجع المطورين وإرشادات التشغيل المحلي." : "Explore the Phase 1 task contract, adapter catalog, and local runtime instructions."}</p>
           <p class="ef-mt-12"><a class="ef-cap-link" href="${hrefFor("/developers", locale)}">${escapeHtml(t.exploreDocs)} ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
         </div>
       </div>`;

  return `<section class="ef-page-hero">
    <div class="ef-container">
      <div class="ef-section-title-row">
        
        <h1>${escapeHtml(displayTitle)}</h1>
      </div>
      ${isLegal && isAr ? "" : `<p class="ef-page-lead">${escapeHtml(description)}</p>`}
    </div>
  </section>
  <section class="ef-section${isLegal ? " ef-legal-section" : ""}">
    <article class="ef-container ef-article${isLegal ? " ef-legal-document" : ""}"${isLegal ? " data-legal-document" : ""}>
      ${isLegal ? `<div class="ef-legal-progress" role="progressbar" aria-label="${isAr ? "تقدم القراءة" : "Reading progress"}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-reading-progress><span data-reading-progress-fill></span></div>
      <div class="ef-legal-layout">
        <aside class="ef-legal-toc" aria-label="${isAr ? "التنقل ضمن الوثيقة" : "Document navigation"}">
          <h2>${isAr ? "في هذه الصفحة" : "On this page"}</h2>
          <nav>${legalSectionLabels.map((label, index) => `<a href="#${legalSectionIds[index]}" data-legal-toc-link${index === 0 ? ' aria-current="location"' : ""}>${escapeHtml(label)}</a>`).join("")}</nav>
        </aside>
        <div class="ef-legal-body" data-legal-body>` : ""}
      ${content}
      ${isLegal ? "</div></div>" : ""}
    </article>
  </section>`;
}

export function renderMarketingPage(requestUrl, routePath, locale = "en", oauthDetails = {}) {
  const selectedLocale = LANGUAGES.includes(locale) ? locale : "en";
  const t = COPY[selectedLocale];
  const ld = getLocaleData(selectedLocale);
  const allRoutes = [...ROUTES, ...UNIFIED_NON_SITEMAP_ROUTES];
  const route = allRoutes.find(([path]) => path === routePath) || ROUTES[1];
  const title = route[1];
  const description = route[2];
  const isAuthRoute = AUTH_ROUTES.some(([authPath]) => authPath === routePath);
  const isNonSitemapExtra = UNIFIED_NON_SITEMAP_ROUTES.some(([extraPath]) => extraPath === routePath);

  const body = `${header(routePath, selectedLocale, t)}${
    routePath === "/" ? homeBody(t, selectedLocale) : genericBody(route, routePath, t, selectedLocale, oauthDetails)
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
    includeAlternates: !isAuthRoute && !isNonSitemapExtra,
    robots: isAuthRoute ? "noindex, nofollow" : null,
    skipLabel: ld.skipToContent,
  });
}

export function renderMarketingNotFoundPage(requestUrl, locale = "en") {
  const selectedLocale = LANGUAGES.includes(locale) ? locale : "en";
  const t = COPY[selectedLocale];
  const ld = getLocaleData(selectedLocale);
  const body = `${header("/404", selectedLocale, t)}
    <section class="ef-page-hero">
      <div class="ef-container">
        <div class="ef-section-title-row">
          
          <h1>${escapeHtml(t.notFoundTitle)}</h1>
        </div>
        <p class="ef-page-lead">${escapeHtml(t.notFoundDesc)}</p>
        <div class="ef-hero-actions ef-mt-28">
          <a class="ef-btn ef-btn-primary" href="${hrefFor("/", selectedLocale)}">
            <span>${escapeHtml(t.returnHome)}</span>
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
    skipLabel: ld.skipToContent,
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
  const allRoutes = [...ROUTES, ...UNIFIED_NON_SITEMAP_ROUTES];
  if (!allRoutes.some(([route]) => route === path)) return null;
  return { path, locale };
}

export const MARKETING_PATHS = ROUTES
  .filter(([path]) => !AUTH_ROUTES.some(([authPath]) => authPath === path))
  .map(([path]) => path)
  .flatMap((path) =>
    path === "/" ? ["/"] : [path, ...LANGUAGES.filter((locale) => locale !== "en").map((locale) => `/${locale}${path}`)],
  );
