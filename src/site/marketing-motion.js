export const MARKETING_MOTION_JS = `(function () {
  "use strict";

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  var root = document.documentElement;
  var scope = document.querySelector("main") || document.body;
  var media = gsap.matchMedia(scope);

  media.add({
    reducedMotion: "(prefers-reduced-motion: reduce)",
    compact: "(max-width: 720px)"
  }, function (context) {
    var conditions = context.conditions;
    if (conditions.reducedMotion || root.getAttribute("data-motion") === "paused") return;

    var animations = [];
    var hero = document.querySelector(".ef-hero-layout");

    if (hero) {
      var entrance = gsap.timeline({ defaults: { duration: 0.62, ease: "power3.out" } });
      entrance.fromTo(".ef-hero-copy > *", { y: 18, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        stagger: 0.075,
        clearProps: "transform,opacity,visibility"
      });
      entrance.fromTo(".ef-graph-card", { y: 18, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        clearProps: "transform,opacity,visibility"
      }, "<0.12");
      entrance.fromTo(".ef-g-node", { y: 8, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        stagger: 0.035,
        duration: 0.38,
        clearProps: "transform,opacity,visibility"
      }, "<0.18");
      animations.push(entrance);
    }

    var headings = gsap.utils.toArray(".ef-section-head .ef-section-title, .ef-page-hero h1", scope);
    var headingTriggers = ScrollTrigger.batch(headings, {
      start: "top 88%",
      once: true,
      interval: 0.12,
      batchMax: conditions.compact ? 2 : 4,
      onEnter: function (elements) {
        animations.push(gsap.fromTo(elements, { y: 12, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.52,
          stagger: 0.065,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
          overwrite: true
        }));
      }
    });

    var graph = document.querySelector("[data-exec-graph]");
    var scenarioButtons = graph ? Array.prototype.slice.call(graph.querySelectorAll("[data-graph-scenario]")) : [];
    var replayRoute = function () {
      if (root.getAttribute("data-motion") === "paused") return;
      var paths = graph.querySelectorAll(".ef-g-path-active");
      animations.push(gsap.fromTo(paths, { strokeDasharray: "2 8", strokeDashoffset: 36 }, {
        strokeDashoffset: 0,
        duration: 0.68,
        stagger: 0.07,
        ease: "power2.out",
        overwrite: true
      }));
    };
    scenarioButtons.forEach(function (button) {
      button.addEventListener("click", replayRoute);
    });

    return function () {
      scenarioButtons.forEach(function (button) {
        button.removeEventListener("click", replayRoute);
      });
      headingTriggers.forEach(function (trigger) { trigger.kill(); });
      animations.forEach(function (animation) { animation.kill(); });
    };
  });

  var motionButtons = document.querySelectorAll("[data-motion-toggle]");
  var syncMotion = function () {
    if (root.getAttribute("data-motion") === "paused" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.globalTimeline.pause();
    } else {
      gsap.globalTimeline.resume();
    }
  };
  motionButtons.forEach(function (button) { button.addEventListener("click", syncMotion); });

  window.addEventListener("pagehide", function () {
    media.revert();
    motionButtons.forEach(function (button) { button.removeEventListener("click", syncMotion); });
  }, { once: true });
})();`;
