export const SITE_JS = `(function () {
  "use strict";

  // 1. Mobile navigation toggle
  var menuBtn = document.querySelector("[data-menu-toggle]");
  var drawer = document.querySelector("[data-mobile-drawer]");
  if (menuBtn && drawer) {
    var setOpen = function (open) {
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      drawer.classList.toggle("is-open", open);
    };
    menuBtn.addEventListener("click", function () {
      var expanded = menuBtn.getAttribute("aria-expanded") === "true";
      setOpen(!expanded);
    });
    drawer.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  // 2. Copy to clipboard for all code/JSON snippets
  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-copy-target]");
    if (!btn) return;
    var targetId = btn.getAttribute("data-copy-target");
    var el = targetId ? document.getElementById(targetId) : null;
    if (!el) return;
    var text = el.textContent || "";
    var confirmCopy = function () {
      var original = btn.getAttribute("data-copy-label") || "Copy";
      btn.textContent = "Copied";
      setTimeout(function () {
        btn.textContent = original;
      }, 1500);
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(confirmCopy).catch(function () {});
    }
  });

  // 3. Homepage capability maturity filters and expandable contract details
  var filterButtons = document.querySelectorAll("[data-cap-filter]");
  var capCards = document.querySelectorAll("[data-cap-card]");
  if (filterButtons.length && capCards.length) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-cap-filter");
        filterButtons.forEach(function (other) {
          other.setAttribute("aria-pressed", other === btn ? "true" : "false");
        });
        capCards.forEach(function (card) {
          var matches = key === "all" || card.getAttribute("data-maturity-key") === key;
          card.classList.toggle("is-hidden", !matches);
        });
      });
    });
  }

  document.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-cap-toggle]");
    if (!toggle) return;
    var panelId = toggle.getAttribute("aria-controls");
    var panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    var expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    toggle.textContent = expanded ? "Inspect contract & bounds" : "Hide contract details";
    panel.hidden = expanded;
  });

  // 4. Platform 7-layer interactive architecture explorer
  var layerButtons = document.querySelectorAll("[data-layer-id]");
  var inspector = document.querySelector("[data-layer-inspector]");
  if (layerButtons.length && inspector) {
    var layersDataEl = document.getElementById("ef-platform-layers-json");
    var layers = layersDataEl ? JSON.parse(layersDataEl.textContent || "[]") : [];
    var byId = {};
    layers.forEach(function (item) { byId[item.id] = item; });

    var renderInspector = function (layer) {
      if (!layer) return;
      inspector.querySelector("[data-insp-step]").textContent = layer.step + " · " + layer.maturity;
      inspector.querySelector("[data-insp-name]").textContent = layer.name;
      inspector.querySelector("[data-insp-resp]").textContent = layer.responsibility;
      inspector.querySelector("[data-insp-how]").textContent = layer.howItWorks;
      inspector.querySelector("[data-insp-controls]").textContent = layer.controls;
    };

    layerButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-layer-id");
        layerButtons.forEach(function (other) {
          other.setAttribute("aria-selected", other === btn ? "true" : "false");
        });
        renderInspector(byId[id]);
      });
    });
  }

  // 5. Use Cases sample JSON expanders
  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-uc-toggle]");
    if (!btn) return;
    var targetId = btn.getAttribute("aria-controls");
    var panel = targetId ? document.getElementById(targetId) : null;
    if (!panel) return;
    var open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", open ? "false" : "true");
    btn.textContent = open ? "View expected JSON shape" : "Hide JSON shape";
    panel.hidden = open;
  });

  // 6. FAQ controls (expand/collapse all + category filter)
  var faqItems = document.querySelectorAll("[data-faq-item]");
  var faqFilterBtns = document.querySelectorAll("[data-faq-filter]");
  if (faqFilterBtns.length && faqItems.length) {
    faqFilterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-faq-filter");
        faqFilterBtns.forEach(function (other) {
          other.setAttribute("aria-pressed", other === btn ? "true" : "false");
        });
        faqItems.forEach(function (item) {
          item.hidden = !(cat === "all" || item.getAttribute("data-faq-category") === cat);
        });
      });
    });
  }
  var expandAllBtn = document.querySelector("[data-faq-expand-all]");
  var collapseAllBtn = document.querySelector("[data-faq-collapse-all]");
  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", function () {
      faqItems.forEach(function (item) {
        if (!item.hidden) item.open = true;
      });
    });
  }
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", function () {
      faqItems.forEach(function (item) {
        item.open = false;
      });
    });
  }

  // 7. Interactive Product Demonstration (pure in-browser simulation — zero network calls)
  var demoRoot = document.querySelector("[data-demo-workbench]");
  if (demoRoot) {
    var presetsEl = document.getElementById("ef-demo-presets-json");
    var presets = presetsEl ? JSON.parse(presetsEl.textContent || "{}") : {};

    var presetBtns = demoRoot.querySelectorAll("[data-demo-preset]");
    var goalInput = document.getElementById("demo-goal");
    var urlInput = document.getElementById("demo-url");
    var opSelect = document.getElementById("demo-operation");
    var timeoutInput = document.getElementById("demo-timeout");
    var maxBytesInput = document.getElementById("demo-max-bytes");
    var maxRedirectsInput = document.getElementById("demo-max-redirects");
    var runBtn = document.getElementById("demo-run-btn");
    var resetBtn = document.getElementById("demo-reset-btn");

    var stageEls = demoRoot.querySelectorAll("[data-stage-index]");
    var stateBadgeEl = document.getElementById("demo-task-state");
    var adapterBadgeEl = document.getElementById("demo-adapter-id");
    var statusCodeEl = document.getElementById("demo-http-status");
    var latencyEl = document.getElementById("demo-duration");
    var evidenceSummaryEl = document.getElementById("demo-evidence-summary");
    var eventsListEl = document.getElementById("demo-events-list");
    var jsonOutEl = document.getElementById("demo-json-output");
    var activePresetId = "public-fetch";

    var blockedHostExact = new Set([
      "localhost",
      "metadata",
      "metadata.google.internal",
      "metadata.azure.internal",
      "instance-data",
      "exportflow.me",
      "exportflow-platform.hhameranede.workers.dev"
    ]);
    var blockedSuffixes = [
      ".localhost", ".local", ".localdomain", ".internal", ".home", ".lan",
      ".test", ".invalid", ".example", ".onion", ".arpa", ".home.arpa",
      ".svc", ".cluster.local", ".corp", ".intranet", ".exportflow.me"
    ];

    function validateUrlForPreview(rawUrl) {
      if (!rawUrl || rawUrl.length > 2048) {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "Destination URL is missing or exceeds 2048 characters." };
      }
      var parsed;
      try {
        parsed = new URL(rawUrl);
      } catch (_e) {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "Destination URL could not be parsed." };
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "Only HTTP and HTTPS protocols are permitted." };
      }
      if (parsed.username || parsed.password) {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "Embedded credentials in URLs are rejected." };
      }
      if (parsed.port) {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "Non-default ports are disallowed by egress policy." };
      }
      var host = parsed.hostname.toLowerCase().replace(/\\.$/, "");
      if (
        !host ||
        host.startsWith("[") ||
        host.indexOf(":") !== -1 ||
        /^[0-9.]+$/.test(host) ||
        host.indexOf(".") === -1
      ) {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "IP literals and non-public domain forms are blocked by egress policy." };
      }
      if (
        blockedHostExact.has(host) ||
        blockedSuffixes.some(function (sfx) { return host.endsWith(sfx); })
      ) {
        return { ok: false, code: "URL_NOT_ALLOWED", message: "Local, reserved, and ExportFlow-owned hostnames are disallowed." };
      }
      parsed.hostname = host;
      parsed.hash = "";
      return { ok: true, href: parsed.href };
    }

    function simulateTask() {
      var goal = (goalInput.value || "").trim();
      var rawUrl = (urlInput.value || "").trim();
      var operation = opSelect.value;
      var timeoutMs = Number(timeoutInput.value);
      var maxBytes = Number(maxBytesInput.value);
      var maxRedirects = Number(maxRedirectsInput.value);
      var preset = presets[activePresetId] || presets["public-fetch"];

      var ts0 = "2026-11-19T12:00:00.000Z";
      var ts1 = "2026-11-19T12:00:00.012Z";
      var ts2 = "2026-11-19T12:00:00.088Z";

      var stages = ["passed", "passed", "passed", "passed", "passed", "passed"];

      if (!goal || goal.length > 2000) {
        stages = ["passed", "failed", "skipped", "skipped", "skipped", "skipped"];
        return renderResult({
          stages: stages,
          httpStatus: 400,
          adapter: "contract.validator",
          state: "validation_error",
          payload: {
            previewMode: "illustrative_simulation",
            error: { code: "INVALID_GOAL", message: "Task goal must be 1 to 2000 characters." }
          }
        });
      }

      if (
        !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000 ||
        !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576 ||
        !Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 3
      ) {
        stages = ["passed", "failed", "skipped", "skipped", "skipped", "skipped"];
        return renderResult({
          stages: stages,
          httpStatus: 400,
          adapter: "contract.validator",
          state: "validation_error",
          payload: {
            previewMode: "illustrative_simulation",
            error: { code: "INVALID_LIMIT", message: "Limits must stay within timeoutMs [1..8000], maxBytes [1..1048576], maxRedirects [0..3]." }
          }
        });
      }

      if (operation !== "fetch") {
        stages = ["passed", "failed", "skipped", "skipped", "skipped", "skipped"];
        return renderResult({
          stages: stages,
          httpStatus: 501,
          adapter: "task.contract",
          state: "unsupported",
          payload: {
            previewMode: "illustrative_simulation",
            error: {
              code: "OPERATION_NOT_ENABLED",
              message: "Operation '" + operation + "' is an internal prototype and is not enabled on the execution endpoint yet; only 'fetch' is active in Phase 1."
            }
          }
        });
      }

      var urlCheck = validateUrlForPreview(rawUrl);
      if (!urlCheck.ok) {
        stages = ["passed", "failed", "skipped", "skipped", "skipped", "skipped"];
        return renderResult({
          stages: stages,
          httpStatus: 400,
          adapter: "egress-guard",
          state: "rejected",
          payload: {
            previewMode: "illustrative_simulation",
            error: { code: urlCheck.code, message: urlCheck.message }
          }
        });
      }

      if ((preset && preset.forceOutcome === "RESPONSE_TOO_LARGE") || maxBytes < 300) {
        stages = ["passed", "passed", "passed", "failed", "passed", "skipped"];
        return renderResult({
          stages: stages,
          httpStatus: 413,
          adapter: "http.fetch.v1",
          state: "failed",
          payload: {
            previewMode: "illustrative_simulation",
            id: "preview-task-cap-413",
            goal: goal,
            requestedUrl: urlCheck.href,
            state: "failed",
            execution: {
              path: "http",
              operation: "fetch",
              adapterId: "http.fetch.v1",
              reason: "Direct HTTP is the lightest suitable first attempt."
            },
            timestamps: { createdAt: ts0, startedAt: ts1, completedAt: ts2 },
            usage: { durationMs: 18, requestsAttempted: null, responseBytes: 0, cost: null },
            events: [
              { type: "task.accepted", at: ts0 },
              { type: "task.started", at: ts1, executionPath: "http" },
              { type: "task.failed", at: ts2, reason: "RESPONSE_TOO_LARGE" }
            ],
            errors: [{ code: "RESPONSE_TOO_LARGE", message: "Upstream response exceeded the maximum allowed byte limit." }],
            result: {
              status: "failed",
              data: { errorCode: "RESPONSE_TOO_LARGE", requestedUrl: urlCheck.href },
              sources: [],
              warnings: ["Task failed (RESPONSE_TOO_LARGE)."],
              generatedAt: ts2
            }
          }
        });
      }

      var redirects = (preset && preset.illustrativeRedirects && urlCheck.href.indexOf("docs.example.org") !== -1)
        ? preset.illustrativeRedirects
        : [];
      var finalUrl = redirects.length ? redirects[redirects.length - 1].to : urlCheck.href;
      var body = (preset && preset.illustrativeBody) ||
        "<!doctype html><html><head><title>Illustrative Public Document</title></head><body><h1>Preview Response</h1><p>Illustrative body for " + urlCheck.href + "</p></body></html>";
      var bytes = (preset && preset.illustrativeBytes && urlCheck.href === preset.url) ? preset.illustrativeBytes : body.length;

      return renderResult({
        stages: stages,
        httpStatus: 200,
        adapter: "http.fetch.v1",
        state: "succeeded",
        payload: {
          previewMode: "illustrative_simulation",
          id: "preview-task-0001",
          goal: goal,
          requestedUrl: urlCheck.href,
          state: "succeeded",
          execution: {
            path: "http",
            operation: "fetch",
            adapterId: "http.fetch.v1",
            reason: "Direct HTTP is the lightest suitable first attempt."
          },
          timestamps: { createdAt: ts0, startedAt: ts1, completedAt: ts2 },
          usage: {
            durationMs: 76,
            requestsAttempted: 1 + redirects.length,
            responseBytes: bytes,
            cost: null
          },
          events: [
            { type: "task.accepted", at: ts0 },
            { type: "task.started", at: ts1, executionPath: "http" },
            { type: "task.succeeded", at: ts2 }
          ],
          errors: [],
          result: {
            status: "succeeded",
            data: {
              status: 200,
              httpStatus: 200,
              contentType: "text/html; charset=utf-8",
              body: body,
              bytes: bytes,
              originalUrl: urlCheck.href,
              requestedUrl: urlCheck.href,
              finalUrl: finalUrl,
              redirects: redirects
            },
            sources: [
              {
                url: finalUrl,
                retrievedAt: ts2,
                title: (preset && preset.illustrativeTitle) || "Illustrative Public Document",
                evidence: [
                  {
                    type: "http_response",
                    status: 200,
                    contentType: "text/html; charset=utf-8",
                    bytes: bytes,
                    redirectCount: redirects.length
                  }
                ]
              }
            ],
            warnings: [],
            generatedAt: ts2
          }
        }
      });
    }

    function renderResult(out) {
      stageEls.forEach(function (node) {
        var idx = Number(node.getAttribute("data-stage-index"));
        node.setAttribute("data-state", out.stages[idx] || "skipped");
      });

      stateBadgeEl.textContent = out.state;
      adapterBadgeEl.textContent = out.adapter;
      statusCodeEl.textContent = String(out.httpStatus);
      var dur = out.payload && out.payload.usage ? out.payload.usage.durationMs + " ms (sample)" : "n/a";
      latencyEl.textContent = dur;

      if (out.payload.result && out.payload.result.sources && out.payload.result.sources.length) {
        var src = out.payload.result.sources[0];
        var ev = src.evidence && src.evidence[0];
        evidenceSummaryEl.textContent =
          "Final URL: " + src.url + " · Redirects: " + (ev ? ev.redirectCount : 0) + " · Retrieved: " + src.retrievedAt;
      } else if (out.payload.error) {
        evidenceSummaryEl.textContent = "No external request sent — blocked or rejected at " + out.adapter + " (" + out.payload.error.code + ").";
      } else if (out.payload.errors && out.payload.errors.length) {
        evidenceSummaryEl.textContent = "Task halted cleanly (" + out.payload.errors[0].code + ").";
      }

      if (eventsListEl) {
        eventsListEl.innerHTML = "";
        var evts = out.payload.events || [];
        if (!evts.length) {
          var liEmpty = document.createElement("li");
          liEmpty.textContent = "Request failed contract validation before task lifecycle began.";
          eventsListEl.appendChild(liEmpty);
        } else {
          evts.forEach(function (evItem) {
            var li = document.createElement("li");
            li.textContent = evItem.type + " (" + evItem.at + ")";
            eventsListEl.appendChild(li);
          });
        }
      }

      jsonOutEl.textContent = JSON.stringify(out.payload, null, 2);
    }

    function applyPreset(presetId) {
      var p = presets[presetId];
      if (!p) return;
      activePresetId = presetId;
      presetBtns.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-demo-preset") === presetId ? "true" : "false");
      });
      goalInput.value = p.goal;
      urlInput.value = p.url;
      opSelect.value = p.operation || "fetch";
      timeoutInput.value = String(p.timeoutMs);
      maxBytesInput.value = String(p.maxBytes);
      maxRedirectsInput.value = String(p.maxRedirects);
      simulateTask();
    }

    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyPreset(btn.getAttribute("data-demo-preset"));
      });
    });

    if (runBtn) {
      runBtn.addEventListener("click", simulateTask);
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        applyPreset("public-fetch");
      });
    }

    // Detail tabs in demo result viewer
    var tabBtns = demoRoot.querySelectorAll("[data-demo-tab]");
    var tabPanels = demoRoot.querySelectorAll("[data-demo-panel]");
    tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-demo-tab");
        tabBtns.forEach(function (b) {
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        tabPanels.forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-demo-panel") !== name;
        });
      });
    });

    applyPreset("public-fetch");
  }
})();
`;
