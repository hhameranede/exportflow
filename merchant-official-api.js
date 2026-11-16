const root = document.getElementById("merchantWorkspace");

if (root) {
  const signInButton = root.querySelector("#merchantSignIn");
  const signOutButton = root.querySelector("#merchantSignOut");
  const accountStatus = root.querySelector("#merchantAccountStatus");
  const connectionSection = root.querySelector("#merchantConnections");
  const authNotice = root.querySelector("#merchantAuthNotice");
  const trackingForm = root.querySelector("#merchantTrackingForm");
  const trackingCarrier = root.querySelector("#merchantTrackingCarrier");
  const trackingNumber = root.querySelector("#merchantTrackingNumber");
  const trackingButton = root.querySelector("#merchantTrackButton");
  const trackingStatus = root.querySelector("#merchantTrackingStatus");
  const trackingResult = root.querySelector("#merchantTrackingResult");
  const trackingSummary = root.querySelector("#merchantTrackingSummary");
  const trackingEvents = root.querySelector("#merchantTrackingEvents");
  const providers = ["ups", "fedex"];
  let authenticated = false;
  let busy = false;

  function setText(element, value) {
    if (element) element.textContent = String(value ?? "");
  }

  function messageFor(code) {
    const messages = {
      unauthenticated: "Sign in before using your merchant workspace.",
      merchant_auth_not_configured: "Merchant sign-in is not configured in this environment yet.",
      credential_vault_not_configured: "The encrypted credential vault is not configured in this environment yet.",
      carrier_not_connected: "Connect this carrier account before tracking a shipment.",
      carrier_lookup_failed: "The carrier adapter could not return a tracking result. Check the number and try again.",
      carrier_lookup_timeout: "The carrier adapter timed out. Try again later.",
      carrier_rate_limited: "The carrier rate limit was reached. Try again later.",
      global_rate_limiter_unavailable: "The secure request limiter is unavailable. No carrier request was sent.",
      global_rate_limiter_not_configured: "The secure request limiter is not configured. No carrier request was sent.",
      forbidden: "This merchant account is not permitted to use this connection.",
      origin_forbidden: "The request origin was not accepted.",
      credential_decryption_failed: "The saved credentials could not be opened. Reconnect the carrier account.",
      vault_unavailable: "The credential vault is temporarily unavailable.",
      invalid_tracking_number: "Enter a valid tracking number for the selected carrier."
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

  function selectedProviderConnected() {
    const panel = root.querySelector('[data-provider-panel="' + trackingCarrier.value + '"]');
    return panel?.dataset.connected === "true";
  }

  function updateControls() {
    root.querySelectorAll("button").forEach(button => {
      if (button.dataset.stayEnabled === "true") return;
      button.disabled = busy || (!authenticated && button !== signInButton);
    });

    root.querySelectorAll("[data-provider-panel]").forEach(panel => {
      const connected = panel.dataset.connected === "true";
      const form = panel.querySelector("form");
      if (form) form.querySelectorAll("input, button").forEach(control => {
        control.disabled = !authenticated || busy;
      });
      const disconnect = panel.querySelector('[data-action="disconnect"]');
      if (disconnect) disconnect.disabled = !authenticated || busy || !connected;
    });

    if (trackingForm) {
      trackingForm.querySelectorAll("input, select, button").forEach(control => {
        control.disabled = !authenticated || busy;
      });
    }
    if (trackingButton) trackingButton.disabled = !authenticated || busy || !selectedProviderConnected();
    if (signInButton) signInButton.hidden = authenticated;
    if (signOutButton) signOutButton.hidden = !authenticated;
    if (connectionSection) connectionSection.hidden = !authenticated;
    if (authNotice) authNotice.hidden = authenticated;
  }

  function setBusy(value) {
    busy = value;
    updateControls();
  }

  function clearTrackingResult() {
    trackingResult.hidden = true;
    setText(trackingSummary, "");
    trackingEvents.replaceChildren();
  }

  function renderTrackingResult(result) {
    clearTrackingResult();
    const carrier = String(result.carrier || result.provider || "").toUpperCase();
    const status = String(result.status || "unknown").replaceAll("_", " ");
    const delivery = result.expectedDelivery ? " · Expected delivery: " + result.expectedDelivery : "";
    setText(trackingSummary,
      carrier + " · " + status + delivery + " · Source: " + String(result.source || "carrier adapter"));

    const events = Array.isArray(result.events) ? result.events : [];
    events.forEach(event => {
      const item = document.createElement("li");
      item.className = "merchant-event";
      const heading = document.createElement("strong");
      heading.textContent = String(event.stage || "update").replaceAll("_", " ");
      const description = document.createElement("p");
      description.textContent = String(event.description || "Carrier update");
      const metadata = document.createElement("p");
      metadata.className = "merchant-event-meta";
      metadata.textContent = [event.time, event.location].filter(value => typeof value === "string" && value).join(" · ");
      item.append(heading, description, metadata);
      trackingEvents.append(item);
    });

    if (events.length === 0) {
      const item = document.createElement("li");
      item.className = "merchant-event";
      item.textContent = "The carrier returned a status without a scan timeline.";
      trackingEvents.append(item);
    }
    trackingResult.hidden = false;
  }

  async function refreshProvider(provider) {
    const panel = root.querySelector('[data-provider-panel="' + provider + '"]');
    if (!panel) return;
    const status = panel.querySelector("[data-provider-status]");
    try {
      const result = await requestJson("/api/merchant/carriers/" + provider + "/official-credentials");
      panel.dataset.connected = result.connected === true ? "true" : "false";
      setText(status, result.connected === true
        ? "Credentials saved securely. Shipment lookups use the existing " + provider.toUpperCase() + " adapter."
        : "No credentials saved. Connect the carrier account you manage.");
    } catch (error) {
      panel.dataset.connected = "false";
      setText(status, messageFor(error.message));
    }
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
        setText(accountStatus, "Sign in to manage your carrier connections and shipments.");
      } else {
        setText(accountStatus, messageFor(data.error || "merchant_auth_not_configured"));
      }
    } catch {
      authenticated = false;
      setText(accountStatus, "Merchant sign-in status is temporarily unavailable.");
    }
    updateControls();
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
      await requestJson("/api/merchant/session", {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      authenticated = false;
      root.querySelectorAll("[data-provider-panel]").forEach(panel => {
        panel.dataset.connected = "false";
        setText(panel.querySelector("[data-provider-status]"), "Sign in to view this connection.");
      });
      clearTrackingResult();
      setText(accountStatus, "Signed out.");
      setText(trackingStatus, "Sign in to track a shipment.");
    } catch (error) {
      setText(accountStatus, messageFor(error.message));
    } finally {
      setBusy(false);
    }
  });

  providers.forEach(provider => {
    const panel = root.querySelector('[data-provider-panel="' + provider + '"]');
    const form = panel?.querySelector("form");
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
      setText(status, "Saving credentials in the encrypted merchant vault…");
      try {
        await requestJson("/api/merchant/carriers/" + provider + "/official-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ credentials, consent: true })
        });
        setText(status, "Credentials saved securely. The existing adapter will use them for shipment lookups.");
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

    disconnectButton?.addEventListener("click", async () => {
      if (!authenticated || busy || panel.dataset.connected !== "true") return;
      if (!window.confirm("Disconnect this carrier account and delete its saved credentials?")) return;
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

  trackingCarrier?.addEventListener("change", updateControls);

  trackingForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authenticated || busy) return;

    const provider = trackingCarrier.value;
    const number = trackingNumber.value.trim();
    if (!providers.includes(provider) || !selectedProviderConnected()) {
      setText(trackingStatus, messageFor("carrier_not_connected"));
      return;
    }
    if (!number) {
      setText(trackingStatus, messageFor("invalid_tracking_number"));
      return;
    }

    clearTrackingResult();
    setBusy(true);
    setText(trackingStatus, "Sending the lookup through the " + provider.toUpperCase() + " carrier adapter…");
    try {
      const result = await requestJson("/api/merchant/carriers/" + provider + "/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ number })
      });
      renderTrackingResult(result);
      setText(trackingStatus, "Carrier adapter returned a tracking response.");
    } catch (error) {
      setText(trackingStatus, messageFor(error.message));
    } finally {
      setBusy(false);
    }
  });

  const authResult = new URLSearchParams(window.location.search).get("auth");
  if (authResult === "success") setText(accountStatus, "Sign-in completed. Loading your merchant account…");
  if (authResult?.startsWith("failed")) {
    setText(accountStatus, "Sign-in was not completed. Check the merchant account configuration and try again.");
  }
  loadSession();
}
