(() => {
  "use strict";

  if (window.__xVideoSpeedLoaded) return;
  window.__xVideoSpeedLoaded = true;

  const SPEEDS = [1, 1.25, 1.33, 1.5, 2];
  const STORAGE_KEY = "xVideoPlaybackSpeed";
  const controlsByVideo = new WeakMap();
  const controllers = new Set();

  let selectedSpeed = 1;
  let openController = null;
  let scanQueued = false;

  const formatSpeed = (speed) => `${speed}\u00d7`;

  function isSupportedSpeed(value) {
    return typeof value === "number" && SPEEDS.includes(value);
  }

  function applySpeed(video) {
    if (!video.isConnected) return;

    try {
      video.defaultPlaybackRate = selectedSpeed;
      if (Math.abs(video.playbackRate - selectedSpeed) > 0.001) {
        video.playbackRate = selectedSpeed;
      }
    } catch {
      // Leave videos that do not allow rate changes alone.
    }
  }

  function updateControls() {
    for (const controller of controllers) {
      if (!controller.mount.isConnected || !controller.video.isConnected) {
        controllers.delete(controller);
        continue;
      }

      controller.trigger.textContent = formatSpeed(selectedSpeed);

      for (const option of controller.options) {
        const isSelected = Number(option.dataset.speed) === selectedSpeed;
        option.classList.toggle("selected", isSelected);
        option.setAttribute("aria-checked", String(isSelected));
      }
    }
  }

  function applySpeedToAllVideos() {
    document.querySelectorAll("video").forEach(applySpeed);
    updateControls();
  }

  function saveSpeed(speed) {
    chrome.storage.local.set({ [STORAGE_KEY]: speed });
  }

  function chooseSpeed(speed) {
    if (!isSupportedSpeed(speed)) return;

    selectedSpeed = speed;
    saveSpeed(speed);
    applySpeedToAllVideos();
  }

  function closeMenu(controller = openController) {
    if (!controller) return;

    controller.menu.hidden = true;
    controller.trigger.setAttribute("aria-expanded", "false");

    if (openController === controller) openController = null;
  }

  function toggleMenu(controller) {
    if (openController && openController !== controller) {
      closeMenu(openController);
    }

    const shouldOpen = controller.menu.hidden;
    controller.menu.hidden = !shouldOpen;
    controller.trigger.setAttribute("aria-expanded", String(shouldOpen));
    openController = shouldOpen ? controller : null;
  }

  function findPlayer(video) {
    return (
      video.closest('[data-testid="videoPlayer"]') ||
      video.closest('[aria-label="Embedded video"]') ||
      video.parentElement
    );
  }

  function makeController(video, player) {
    const mount = document.createElement("div");
    mount.dataset.xVideoSpeedControl = "true";
    mount.style.cssText = [
      "position:absolute",
      "top:8px",
      "right:8px",
      "z-index:2147483646",
      "pointer-events:auto"
    ].join(";");

    const shadow = mount.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          color-scheme: dark;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        button {
          border: 0;
          color: #f7f9f9;
          font: inherit;
          cursor: pointer;
        }

        .control {
          position: relative;
        }

        .trigger {
          min-width: 46px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          background: rgba(15, 20, 25, 0.88);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.32);
          font-size: 13px;
          font-weight: 700;
          line-height: 30px;
          backdrop-filter: blur(8px);
        }

        .trigger:hover,
        .trigger:focus-visible {
          background: rgba(39, 44, 48, 0.96);
          outline: 2px solid #1d9bf0;
          outline-offset: 2px;
        }

        .menu {
          position: absolute;
          top: 40px;
          right: 0;
          width: 118px;
          padding: 6px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          background: rgba(15, 20, 25, 0.97);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.48);
          backdrop-filter: blur(12px);
        }

        .menu[hidden] {
          display: none;
        }

        .option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 34px;
          padding: 0 10px;
          border-radius: 8px;
          background: transparent;
          font-size: 14px;
          text-align: left;
        }

        .option:hover,
        .option:focus-visible {
          background: rgba(255, 255, 255, 0.1);
          outline: none;
        }

        .option::after {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: transparent;
        }

        .option.selected::after {
          background: #1d9bf0;
        }
      </style>
      <div class="control">
        <button
          class="trigger"
          type="button"
          aria-label="Playback speed"
          aria-haspopup="menu"
          aria-expanded="false"
        >1\u00d7</button>
        <div class="menu" role="menu" aria-label="Playback speed" hidden>
          ${SPEEDS.map(
            (speed) => `
              <button
                class="option"
                type="button"
                role="menuitemradio"
                aria-checked="${speed === 1}"
                data-speed="${speed}"
              >${formatSpeed(speed)}</button>
            `
          ).join("")}
        </div>
      </div>
    `;

    const trigger = shadow.querySelector(".trigger");
    const menu = shadow.querySelector(".menu");
    const options = [...shadow.querySelectorAll(".option")];
    const controller = { video, mount, trigger, menu, options };

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu(controller);
    });

    for (const option of options) {
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseSpeed(Number(option.dataset.speed));
        closeMenu(controller);
      });
    }

    if (getComputedStyle(player).position === "static") {
      player.style.position = "relative";
    }

    player.appendChild(mount);
    controlsByVideo.set(video, controller);
    controllers.add(controller);

    let correctionTimer;
    const restoreSelectedSpeed = () => {
      clearTimeout(correctionTimer);
      correctionTimer = setTimeout(() => applySpeed(video), 0);
    };

    video.addEventListener("play", restoreSelectedSpeed);
    video.addEventListener("loadedmetadata", restoreSelectedSpeed);
    video.addEventListener("ratechange", () => {
      if (Math.abs(video.playbackRate - selectedSpeed) > 0.001) {
        restoreSelectedSpeed();
      }
    });

    applySpeed(video);
    updateControls();
  }

  function attachToVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;

    const player = findPlayer(video);
    if (!player) return;

    const existing = controlsByVideo.get(video);
    if (existing) {
      if (existing.mount.parentElement !== player) {
        if (getComputedStyle(player).position === "static") {
          player.style.position = "relative";
        }

        player.appendChild(existing.mount);
      }

      controllers.add(existing);
      applySpeed(video);
      updateControls();
      return;
    }

    makeController(video, player);
  }

  function scanForVideos(root = document) {
    if (root instanceof HTMLVideoElement) attachToVideo(root);

    if (root.querySelectorAll) {
      root.querySelectorAll("video").forEach(attachToVideo);
    }
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;

    requestAnimationFrame(() => {
      scanQueued = false;
      scanForVideos();
    });
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (openController && !openController.mount.contains(event.target)) {
        closeMenu(openController);
      }
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          queueScan();
          return;
        }
      }

      if (mutation.target.nodeType === Node.ELEMENT_NODE) {
        queueScan();
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  chrome.storage.local.get({ [STORAGE_KEY]: 1 }, (result) => {
    if (isSupportedSpeed(result[STORAGE_KEY])) {
      selectedSpeed = result[STORAGE_KEY];
    }

    scanForVideos();
    applySpeedToAllVideos();
  });
})();
