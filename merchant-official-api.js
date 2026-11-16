const root = document.getElementById("merchantWorkspace");

if (root) {
  const signInButton = root.querySelector("#merchantSignIn");
  const signOutButton = root.querySelector("#merchantSignOut");
  const accountStatus = root.querySelector("#merchantAccountStatus");
  const connectionSection = root.querySelector("#merchantConnections");
  const authNotice = root.querySelector("#merchantAuthNotice");
  const trackingForm = root.querySelector("#merchantTrackingForm");
  const carrierSearch = root.querySelector("#merchantCarrierSearch");
  const carrierCount = root.querySelector("#merchantCarrierCount");
  const trackingCarrier = root.querySelector("#merchantTrackingCarrier");
  const trackingNumber = root.querySelector("#merchantTrackingNumber");
  const additionalFields = root.querySelector("#merchantAdditionalFields");
  const trackingButton = root.querySelector("#merchantTrackButton");
  const trackingStatus = root.querySelector("#merchantTrackingStatus");
  const trackingResult = root.querySelector("#merchantTrackingResult");
  const trackingSummary = root.querySelector("#merchantTrackingSummary");
  const trackingEvents = root.querySelector("#merchantTrackingEvents");
  let authenticated = false;
  let busy = false;
  let carrierCatalog = [];
  let catalogLoaded = false;

  function setText(element, value) {
    if (element) element.textContent = String(value ?? "");
  }

  function messageFor(code) {
    const messages = {
      unauthenticated: "Sign in before using your merchant workspace.",
      merchant_auth_not_configured: "Merchant sign-in is not configured in this environment yet.",
      carrier_catalog_unavailable: "The direct carrier catalog is temporarily unavailable. Try again shortly.",
      unsupported_direct_carrier: "Choose a carrier from the direct-adapter catalog.",
      invalid_tracking_number: "Enter a valid tracking number for the selected carrier.",
      invalid_trackingUrl: "Enter the complete tracking link requested by this carrier.",
      invalid_postcode: "Enter a valid delivery postcode.",
      invalid_postcodeCountry: "Enter a two-letter postcode country code.",
      carrier_input_required: "This carrier needs an additional detail. Check the fields shown above.",
      carrier_lookup_failed: "The carrier adapter could not return a tracking result. Check the number and try again.",
      carrier_lookup_timeout: "The carrier adapter timed out. Try again later.",
      carrier_verification_required: "The carrier requires an additional verification step. Try again later.",
      carrier_rate_limited: "The carrier rate limit was reached. Try again later.",
      global_rate_limiter_unavailable: "The secure request limiter is unavailable. No carrier request was sent.",
      global_rate_limiter_not_configured: "The secure request limiter is not configured. No carrier request was sent.",
      origin_forbidden: "The request origin was not accepted."
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

  function selectedCarrier() {
    return carrierCatalog.find(carrier => carrier.id === trackingCarrier.value) || null;
  }

  function updateControls() {
    root.querySelectorAll("button").forEach(button => {
      if (button.dataset.stayEnabled === "true") return;
      button.disabled = busy || (!authenticated && button !== signInButton);
    });
    if (trackingForm) {
      trackingForm.querySelectorAll("input, select, button").forEach(control => {
        control.disabled = !authenticated || busy || !catalogLoaded;
      });
    }
    if (trackingButton) {
      trackingButton.disabled = !authenticated || busy || !catalogLoaded || !selectedCarrier() || !trackingNumber.value.trim();
    }
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
      metadata.textContent = [event.time, event.location]
        .filter(value => typeof value === "string" && value).join(" · ");
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

  function renderCarrierOptions() {
    const previous = trackingCarrier.value;
    const query = carrierSearch.value.trim().toLowerCase();
    const matches = carrierCatalog.filter(carrier => {
      if (!query) return true;
      return [carrier.name, carrier.id, ...(carrier.aliases || [])]
        .some(value => String(value || "").toLowerCase().includes(query));
    });

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = matches.length ? "Select a direct carrier…" : "No direct carriers match this search";
    trackingCarrier.replaceChildren(placeholder);
    matches.forEach(carrier => {
      const option = document.createElement("option");
      option.value = carrier.id;
      option.textContent = carrier.name + " · " + carrier.id;
      trackingCarrier.append(option);
    });

    if (matches.some(carrier => carrier.id === previous)) {
      trackingCarrier.value = previous;
    } else {
      trackingCarrier.value = "";
    }
    setText(carrierCount, matches.length + " of " + carrierCatalog.length + " direct adapters shown");
    renderAdditionalFields();
    updateControls();
  }

  function normalizedNumber(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function activeRequirements(carrier) {
    const number = normalizedNumber(trackingNumber.value);
    return (carrier?.requirements || []).filter(requirement => {
      if (!requirement.whenTrackingNumber) return true;
      try {
        return new RegExp("^(?:" + requirement.whenTrackingNumber + ")$").test(number);
      } catch {
        return false;
      }
    });
  }

  function renderAdditionalFields() {
    if (!additionalFields) return;
    const previousValues = {};
    additionalFields.querySelectorAll("[data-merchant-extra-field]").forEach(input => {
      previousValues[input.name] = input.value;
    });
    additionalFields.replaceChildren();

    const requirements = activeRequirements(selectedCarrier());
    requirements.forEach((requirement, index) => {
      const label = document.createElement("label");
      label.textContent = requirement.label + (requirement.optional ? " (optional)" : "");
      const input = document.createElement("input");
      input.name = requirement.field;
      input.type = requirement.type === "url" ? "url" : "text";
      input.autocomplete = requirement.autoComplete || "off";
      input.maxLength = Number.isInteger(requirement.maxLength) ? requirement.maxLength : 4096;
      input.placeholder = requirement.placeholder || "";
      input.required = requirement.optional !== true;
      input.dataset.merchantExtraField = "true";
      if (requirement.inputMode) input.inputMode = requirement.inputMode;
      if (requirement.pattern) input.pattern = requirement.pattern;
      input.value = previousValues[requirement.field] || "";
      label.append(input);
      additionalFields.append(label);

      if (requirement.help) {
        const help = document.createElement("p");
        help.className = "official-api-description";
        help.textContent = requirement.help;
        additionalFields.append(help);
      }

      if (requirement.readsCountry && requirement.field === "postcode") {
        const countryLabel = document.createElement("label");
        countryLabel.textContent = "Postcode country (two-letter code, optional)";
        const countryInput = document.createElement("input");
        countryInput.name = "postcodeCountry";
        countryInput.type = "text";
        countryInput.maxLength = 2;
        countryInput.autocomplete = "country";
        countryInput.placeholder = "US, FR, DE…";
        countryInput.dataset.merchantExtraField = "true";
        countryInput.value = previousValues.postcodeCountry || "";
        countryLabel.append(countryInput);
        additionalFields.append(countryLabel);
      }
    });
    updateControls();
  }

  async function loadCarrierCatalog() {
    setText(carrierCount, "Loading direct carrier adapters…");
    try {
      const result = await requestJson("/api/merchant/carrier-catalog");
      if (!Array.isArray(result.carriers) || !Number.isInteger(result.count) || result.count !== result.carriers.length) {
        throw new Error("carrier_catalog_unavailable");
      }
      carrierCatalog = result.carriers;
      catalogLoaded = carrierCatalog.length > 0;
      renderCarrierOptions();
      if (!catalogLoaded) {
        setText(trackingStatus, "No direct carrier adapters are available in this environment.");
      }
    } catch (error) {
      catalogLoaded = false;
      setText(carrierCount, messageFor(error.message));
      setText(trackingStatus, messageFor("carrier_catalog_unavailable"));
    }
    updateControls();
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
        await loadCarrierCatalog();
      } else if (response.status === 401) {
        setText(accountStatus, "Sign in to access your merchant shipments.");
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
      carrierCatalog = [];
      catalogLoaded = false;
      clearTrackingResult();
      setText(accountStatus, "Signed out.");
      setText(trackingStatus, "Sign in to track a shipment.");
      trackingCarrier.replaceChildren();
      additionalFields.replaceChildren();
    } catch (error) {
      setText(accountStatus, messageFor(error.message));
    } finally {
      setBusy(false);
    }
  });

  carrierSearch?.addEventListener("input", renderCarrierOptions);
  trackingCarrier?.addEventListener("change", renderAdditionalFields);
  trackingNumber?.addEventListener("input", renderAdditionalFields);

  trackingForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authenticated || busy) return;

    const carrier = selectedCarrier();
    const number = trackingNumber.value.trim();
    if (!carrier) {
      setText(trackingStatus, "Choose a direct carrier from the catalog.");
      return;
    }
    if (!number) {
      setText(trackingStatus, messageFor("invalid_tracking_number"));
      return;
    }

    const payload = { number };
    additionalFields.querySelectorAll("[data-merchant-extra-field]").forEach(input => {
      if (input.value.trim()) payload[input.name] = input.value.trim();
    });

    clearTrackingResult();
    setBusy(true);
    setText(trackingStatus, "Sending the lookup through ExportFlow's " + carrier.name + " direct adapter…");
    try {
      const result = await requestJson("/api/merchant/carriers/" + encodeURIComponent(carrier.id) + "/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      renderTrackingResult(result);
      setText(trackingStatus, "ExportFlow's " + carrier.name + " adapter returned a tracking response.");
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
