const root = document.getElementById("officialApiSandbox");

if (root) {
  const signInButton = root.querySelector("#officialApiSignIn");
  const signOutButton = root.querySelector("#officialApiSignOut");
  const accountStatus = root.querySelector("#officialApiAccountStatus");
  const providerSection = root.querySelector("#officialApiConnections");
  const authNotice = root.querySelector("#officialApiAuthNotice");
  const providers = ["ups", "fedex"];
  let authenticated = false;
  let busy = false;

  function setText(element, value) {
    if (element) element.textContent = String(value ?? "");
  }

  function messageFor(code) {
    const messages = {
      unauthenticated: "Sign in before connecting a carrier account.",
      merchant_auth_not_configured: "Merchant sign-in is not configured in this environment yet.",
      credential_vault_not_configured: "The encrypted credential vault is not configured in this environment yet.",
      carrier_not_connected: "Connect your own carrier account before running the Sandbox check.",
      carrier_sandbox_unavailable: "The carrier Sandbox could not complete the check. Verify the Sandbox credentials and try again.",
      carrier_sandbox_rate_limited: "The carrier Sandbox rate limit was reached. Try again later.",
      global_rate_limiter_unavailable: "The secure request limiter is unavailable. No Sandbox request was sent.",
      global_rate_limiter_not_configured: "The secure request limiter is not configured. No Sandbox request was sent.",
      forbidden: "This merchant account is not permitted to use this connection.",
      origin_forbidden: "The request origin was not accepted.",
      credential_decryption_failed: "The saved credentials could not be opened. Reconnect the carrier account.",
      vault_unavailable: "The credential vault is temporarily unavailable."
    };
    return messages[code] || "The request could not be completed (" + String(code || "unknown_error") + ").";
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(typeof data.error === "string" ? data.error : "request_failed");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button").forEach(button => {
      if (button.dataset.stayEnabled === "true") return;
      button.disabled = value || (button.dataset.authOnly === "true" && !authenticated);
    });
    updateProviderControls();
  }

  function updateProviderControls() {
    const connectedPanels = root.querySelectorAll("[data-provider-panel]");
    connectedPanels.forEach(panel => {
      const enabled = authenticated && !busy;
      const connected = panel.dataset.connected === "true";
      const form = panel.querySelector("form");
      const submit = form?.querySelector('button[type="submit"]');
      const test = panel.querySelector('[data-action="sandbox"]');
      const disconnect = panel.querySelector('[data-action="disconnect"]');
      if (form) form.querySelectorAll("input, button").forEach(control => { control.disabled = !enabled; });
      if (submit) submit.disabled = !enabled;
      if (test) test.disabled = !enabled || !connected;
      if (disconnect) disconnect.disabled = !enabled || !connected;
    });
    if (signInButton) signInButton.hidden = authenticated;
    if (signOutButton) signOutButton.hidden = !authenticated;
    if (providerSection) providerSection.hidden = !authenticated;
    if (authNotice) authNotice.hidden = authenticated;
  }

  async function refreshProvider(provider) {
    const panel = root.querySelector('[data-provider-panel="' + provider + '"]');
    if (!panel) return;
    const status = panel.querySelector("[data-provider-status]");
    try {
      const result = await requestJson("/api/merchant/carriers/" + provider + "/official-credentials");
      panel.dataset.connected = result.connected === true ? "true" : "false";
      setText(status, result.connected === true
        ? "Connected for official Sandbox tests only."
        : "Not connected. Add your own Sandbox credentials below.");
    } catch (error) {
      panel.dataset.connected = "false";
      setText(status, messageFor(error.message));
    }
    updateProviderControls();
  }

  async function loadSession() {
    setText(accountStatus, "Checking merchant sign-in…");
    try {
      const response = await fetch("/api/merchant/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      authenticated = response.ok && data.authenticated === true;
      if (authenticated) {
        setText(accountStatus, "Signed in as " + (data.user?.email || "merchant account"));
        await Promise.all(providers.map(refreshProvider));
      } else if (response.status === 401) {
        setText(accountStatus, "Sign in to manage your own carrier Sandbox connections.");
      } else {
        setText(accountStatus, messageFor(data.error || "merchant_auth_not_configured"));
      }
    } catch {
      authenticated = false;
      setText(accountStatus, "Merchant sign-in status is temporarily unavailable.");
    }
    updateProviderControls();
    if (signInButton && /not configured/i.test(accountStatus.textContent)) {
      signInButton.disabled = true;
    }
  }

  signInButton?.addEventListener("click", async () => {
    signInButton.disabled = true;
    setText(accountStatus, "Opening secure sign-in…");
    try {
      const result = await requestJson("/api/merchant/auth/google/start", {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      if (typeof result.authorizationUrl !== "string" ||
          new URL(result.authorizationUrl).origin !== "https://accounts.google.com") {
        throw new Error("invalid_authorization_response");
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setText(accountStatus, messageFor(error.message));
      signInButton.disabled = false;
    }
  });

  signOutButton?.addEventListener("click", async () => {
    setBusy(true);
    try {
      await requestJson("/api/merchant/session", { method: "DELETE", headers: { Accept: "application/json" } });
      authenticated = false;
      setText(accountStatus, "Signed out. Your device-only watchlist is unchanged.");
      providers.forEach(provider => {
        const panel = root.querySelector('[data-provider-panel="' + provider + '"]');
        if (panel) {
          panel.dataset.connected = "false";
          setText(panel.querySelector("[data-provider-status]"), "Sign in to view this connection.");
        }
      });
    } catch (error) {
      setText(accountStatus, messageFor(error.message));
    } finally {
      setBusy(false);
      updateProviderControls();
    }
  });

  providers.forEach(provider => {
    const panel = root.querySelector('[data-provider-panel="' + provider + '"]');
    const form = panel?.querySelector("form");
    const testButton = panel?.querySelector('[data-action="sandbox"]');
    const disconnectButton = panel?.querySelector('[data-action="disconnect"]');
    const status = panel?.querySelector("[data-provider-status]");

    form?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!authenticated || busy) return;
      const fields = provider === "ups" ? ["clientId", "clientSecret"] : ["apiKey", "apiSecret"];
      const consentInput = form.elements.namedItem("consent");
      if (!consentInput || consentInput.checked !== true) {
        setText(status, "Confirm that you own or are authorized to manage this carrier account.");
        return;
      }
      const credentials = {};
      for (const field of fields) {
        const input = form.elements.namedItem(field);
        credentials[field] = typeof input?.value === "string" ? input.value.trim() : "";
      }
      if (fields.some(field => !credentials[field])) {
        setText(status, "Enter both required credential fields.");
        return;
      }
      setBusy(true);
      setText(status, "Saving credentials securely…");
      try {
        await requestJson("/api/merchant/carriers/" + provider + "/official-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ credentials, consent: true })
        });
        setText(status, "Credentials saved in the encrypted merchant vault. Run the Sandbox check when ready.");
        panel.dataset.connected = "true";
        form.reset();
      } catch (error) {
        setText(status, messageFor(error.message));
      } finally {
        form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
        setBusy(false);
        await refreshProvider(provider);
      }
    });

    testButton?.addEventListener("click", async () => {
      if (!authenticated || busy || panel.dataset.connected !== "true") return;
      setBusy(true);
      setText(status, "Checking the official non-production Sandbox…");
      try {
        const result = await requestJson("/api/merchant/carriers/" + provider + "/sandbox", {
          method: "POST",
          headers: { Accept: "application/json" }
        });
        setText(status, result.result === "passed"
          ? "Sandbox connection passed using the fixed synthetic test reference. No real shipment was queried."
          : "Sandbox returned an unexpected result.");
      } catch (error) {
        setText(status, messageFor(error.message));
      } finally {
        setBusy(false);
        await refreshProvider(provider);
      }
    });

    disconnectButton?.addEventListener("click", async () => {
      if (!authenticated || busy || panel.dataset.connected !== "true") return;
      if (!window.confirm("Disconnect this carrier account and delete its saved Sandbox credentials?")) return;
      setBusy(true);
      setText(status, "Disconnecting carrier account…");
      try {
        await requestJson("/api/merchant/carriers/" + provider + "/official-credentials", {
          method: "DELETE",
          headers: { Accept: "application/json" }
        });
        panel.dataset.connected = "false";
        setText(status, "Carrier credentials revoked.");
      } catch (error) {
        setText(status, messageFor(error.message));
      } finally {
        setBusy(false);
        await refreshProvider(provider);
      }
    });
  });

  const authResult = new URLSearchParams(window.location.search).get("auth");
  if (authResult === "success") setText(accountStatus, "Sign-in completed. Loading your merchant account…");
  if (authResult?.startsWith("failed")) setText(accountStatus, "Sign-in was not completed. Check the merchant account configuration and try again.");
  loadSession();
}
