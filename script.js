const mediaConfig = {
  videoSrc: "./assets/video/background.mp4",
  backgroundMusicSrc: "./assets/audio/music.mp3",
  changeSoundSrc: "./assets/audio/change.wav",
  imageSources: [],
  frameSrc: "./assets/frame/overlay-frame.png",
  searchTargetFrameIndex: 1,
  switchInterval: 5000,
  transitionDuration: 500,
  changeLeadTime: 500,
  backgroundMusicVolume: 0.55,
  changeSoundVolume: 0.9,
  successMessage: "\u60a8\u7684\u53f6\u7247\u5df2\u51fa\u73b0\u81f3\u7b2c\u4e8c\u7a97\u53e3",
  failureMessage: "\u6682\u65e0\u6b64\u53f6\u7247\u4fe1\u606f\uff0c\u8bf7\u91cd\u65b0\u8f93\u5165",
  forcedRotationErrorMessage: "\u5f53\u524d\u56fe\u5e93\u65e0\u6cd5\u6ee1\u8db3\u641c\u7d22\u66ff\u6362\u6761\u4ef6\uff0c\u8bf7\u66f4\u6362\u68c0\u7d22\u5185\u5bb9",
};

const FRAME_COUNT = 4;
const state = {
  frames: [],
  intervalId: null,
  isSwitching: false,
  pendingRotationTimeoutId: null,
  imageLookup: new Map(),
  isSearchOpen: false,
};

const statusBanner = document.getElementById("statusBanner");
const backgroundVideo = document.getElementById("backgroundVideo");
const backgroundMusic = document.getElementById("backgroundMusic");
const changeSound = document.getElementById("changeSound");
const searchFab = document.getElementById("searchFab");
const searchPanel = document.getElementById("searchPanel");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const dialogLayer = document.getElementById("dialogLayer");
const dialogMessage = document.getElementById("dialogMessage");
const dialogConfirm = document.getElementById("dialogConfirm");

document.documentElement.style.setProperty(
  "--transition-duration",
  `${mediaConfig.transitionDuration}ms`,
);

initialize().catch((error) => {
  console.error(error);
  showStatus(error.message || "Media grid failed to initialize.", true);
});

async function initialize() {
  mediaConfig.imageSources = getImageSourcesFromManifest();
  state.imageLookup = buildImageLookup(mediaConfig.imageSources);
  validateConfig();
  setupVideo();
  setupAudio();
  setupFrameOverlays();
  setupSearchUi();
  closeDialog();
  await preloadImages(mediaConfig.imageSources);
  initializeFrameState();
  startRotation();
  registerAudioUnlock();
}

function getImageSourcesFromManifest() {
  if (!Array.isArray(window.IMAGE_SOURCES)) {
    throw new Error("Image manifest is missing. Please regenerate assets/images/image-manifest.js.");
  }

  return [...window.IMAGE_SOURCES];
}

function buildImageLookup(sources) {
  const imageLookup = new Map();

  for (const source of sources) {
    const stem = extractImageStem(source);
    if (!imageLookup.has(stem)) {
      imageLookup.set(stem, source);
    }
  }

  return imageLookup;
}

function extractImageStem(source) {
  const normalizedSource = source.replace(/\\/g, "/");
  const fileName = normalizedSource.substring(normalizedSource.lastIndexOf("/") + 1);
  const dotIndex = fileName.lastIndexOf(".");
  const stem = dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
  return stem.trim().toLowerCase();
}

function validateConfig() {
  if (!Array.isArray(mediaConfig.imageSources) || mediaConfig.imageSources.length < FRAME_COUNT) {
    throw new Error("At least 4 images are required in mediaConfig.imageSources.");
  }
}

function setupVideo() {
  backgroundVideo.src = mediaConfig.videoSrc;

  const playAttempt = backgroundVideo.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      showStatus("Background video is ready but autoplay was blocked on this device.");
    });
  }
}

function setupAudio() {
  backgroundMusic.src = mediaConfig.backgroundMusicSrc;
  backgroundMusic.volume = mediaConfig.backgroundMusicVolume;

  changeSound.src = mediaConfig.changeSoundSrc;
  changeSound.volume = mediaConfig.changeSoundVolume;

  const musicAttempt = backgroundMusic.play();
  if (musicAttempt && typeof musicAttempt.catch === "function") {
    musicAttempt.catch(() => {
      showStatus("Background music will start after the first tap.");
    });
  }
}

function registerAudioUnlock() {
  const unlockAudio = () => {
    const playAttempt = backgroundMusic.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        return;
      });
    }

    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("pointerdown", unlockAudio);
  };

  window.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
  window.addEventListener("pointerdown", unlockAudio, { once: true });
}

function setupSearchUi() {
  searchFab.addEventListener("click", toggleSearchPanel);
  searchForm.addEventListener("submit", handleSearchSubmit);
  searchInput.addEventListener("keydown", handleSearchKeydown);
  searchPanel.addEventListener("click", handleSearchPanelClick);
  dialogConfirm.addEventListener("click", closeDialog);
}

function toggleSearchPanel() {
  if (state.isSearchOpen) {
    closeSearchPanel();
    return;
  }

  openSearchPanel();
}

function openSearchPanel() {
  state.isSearchOpen = true;
  searchPanel.classList.add("is-open");
  searchFab.classList.add("is-hidden");
  searchPanel.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    searchInput.focus();
  }, 120);
}

function closeSearchPanel() {
  state.isSearchOpen = false;
  searchPanel.classList.remove("is-open");
  searchFab.classList.remove("is-hidden");
  searchPanel.setAttribute("aria-hidden", "true");
}

function handleSearchPanelClick(event) {
  if (event.target === searchPanel || event.target.classList.contains("search-panel-shell")) {
    closeSearchPanel();
  }
}

function handleSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
}

function handleSearchSubmit(event) {
  event.preventDefault();
  handleSearch();
}

function handleSearch() {
  const userInput = searchInput.value.trim();
  const matchedImageSource = state.imageLookup.get(userInput.toLowerCase());

  if (!matchedImageSource) {
    showDialog(mediaConfig.failureMessage);
    openSearchPanel();
    return;
  }

  scheduleRotation({
    forcedFrameImage: {
      frameIndex: mediaConfig.searchTargetFrameIndex,
      source: matchedImageSource,
    },
  });
  closeSearchPanel();
}

function setupFrameOverlays() {
  document.querySelectorAll(".frame-overlay").forEach((overlayImage) => {
    overlayImage.src = mediaConfig.frameSrc;
  });
}

async function preloadImages(sources) {
  const results = await Promise.allSettled(sources.map(preloadImage));
  const failed = results
    .map((result, index) => ({ result, src: sources[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failed.length > 0) {
    const failedList = failed.map(({ src }) => src).join(", ");
    throw new Error(`Unable to load image assets: ${failedList}`);
  }
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Image failed to load: ${src}`));
    image.src = src;
  });
}

function initializeFrameState() {
  const startingIndices = pickRandomUniqueIndices(mediaConfig.imageSources.length, FRAME_COUNT);
  const frameElements = Array.from(document.querySelectorAll(".image-frame"));

  state.frames = frameElements.map((frameElement, index) => {
    const layers = Array.from(frameElement.querySelectorAll(".stage-image"));
    const initialImageIndex = startingIndices[index];
    const activeLayerIndex = 0;

    layers[activeLayerIndex].src = mediaConfig.imageSources[initialImageIndex];
    layers[activeLayerIndex].classList.add("is-active");

    return {
      element: frameElement,
      layers,
      activeLayerIndex,
      currentImageIndex: initialImageIndex,
    };
  });
}

function startRotation() {
  window.clearInterval(state.intervalId);
  state.intervalId = window.setInterval(() => scheduleRotation(), mediaConfig.switchInterval);
}

function scheduleRotation(options = {}) {
  if (state.isSwitching) {
    return;
  }

  window.clearTimeout(state.pendingRotationTimeoutId);
  playChangeSound();
  state.pendingRotationTimeoutId = window.setTimeout(() => {
    runRotation(options);
  }, mediaConfig.changeLeadTime);
}

function runRotation(options = {}) {
  if (state.isSwitching) {
    return;
  }

  const forcedImageConstraint = normalizeForcedImageConstraint(options.forcedFrameImage);
  const currentImageIndices = state.frames.map((frame) => frame.currentImageIndex);
  const nextImageIndices = buildNextImageSet(
    currentImageIndices,
    mediaConfig.imageSources.length,
    forcedImageConstraint,
  );

  if (!nextImageIndices) {
    showDialog(mediaConfig.forcedRotationErrorMessage);
    return;
  }

  state.isSwitching = true;
  state.frames.forEach((frame, index) => switchFrameImage(frame, nextImageIndices[index]));

  window.setTimeout(() => {
    state.isSwitching = false;
    state.pendingRotationTimeoutId = null;

    if (forcedImageConstraint) {
      showDialog(mediaConfig.successMessage);
    }
  }, mediaConfig.transitionDuration + 50);
}

function normalizeForcedImageConstraint(forcedFrameImage) {
  if (!forcedFrameImage) {
    return null;
  }

  const forcedImageIndex = mediaConfig.imageSources.indexOf(forcedFrameImage.source);
  if (forcedImageIndex === -1) {
    return null;
  }

  return {
    frameIndex: forcedFrameImage.frameIndex,
    imageIndex: forcedImageIndex,
  };
}

function playChangeSound() {
  changeSound.pause();
  changeSound.currentTime = 0;

  const playAttempt = changeSound.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      return;
    });
  }
}

function buildNextImageSet(currentIndices, totalImages, forcedConstraint = null) {
  const frameOrder = shuffleArray(currentIndices.map((_, index) => index));
  const selected = new Array(currentIndices.length).fill(-1);

  if (forcedConstraint) {
    selected[forcedConstraint.frameIndex] = forcedConstraint.imageIndex;
  }

  function assign(position) {
    if (position >= frameOrder.length) {
      return true;
    }

    const frameIndex = frameOrder[position];
    if (selected[frameIndex] !== -1) {
      return assign(position + 1);
    }

    const used = new Set(selected.filter((value) => value !== -1));
    const candidates = shuffleArray(
      Array.from({ length: totalImages }, (_, imageIndex) => imageIndex).filter(
        (imageIndex) => imageIndex !== currentIndices[frameIndex] && !used.has(imageIndex),
      ),
    );

    for (const candidate of candidates) {
      selected[frameIndex] = candidate;
      if (assign(position + 1)) {
        return true;
      }
      selected[frameIndex] = -1;
    }

    return false;
  }

  return assign(0) ? selected : null;
}

function switchFrameImage(frameState, nextImageIndex) {
  const currentLayer = frameState.layers[frameState.activeLayerIndex];
  const nextLayerIndex = frameState.activeLayerIndex === 0 ? 1 : 0;
  const nextLayer = frameState.layers[nextLayerIndex];

  nextLayer.src = mediaConfig.imageSources[nextImageIndex];
  nextLayer.classList.remove("is-entering", "is-leaving", "is-active");
  currentLayer.classList.remove("is-entering", "is-leaving");

  void nextLayer.offsetWidth;

  nextLayer.classList.add("is-entering");
  currentLayer.classList.add("is-leaving");

  window.setTimeout(() => {
    currentLayer.classList.remove("is-active", "is-leaving");
    nextLayer.classList.remove("is-entering");
    nextLayer.classList.add("is-active");

    frameState.activeLayerIndex = nextLayerIndex;
    frameState.currentImageIndex = nextImageIndex;
  }, mediaConfig.transitionDuration);
}

function pickRandomUniqueIndices(totalItems, count) {
  return shuffleArray(Array.from({ length: totalItems }, (_, index) => index)).slice(0, count);
}

function shuffleArray(items) {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

function showStatus(message, isError = false) {
  if (!isError) {
    statusBanner.textContent = "";
    statusBanner.hidden = true;
    statusBanner.classList.remove("is-error");
    return;
  }

  statusBanner.textContent = message;
  statusBanner.classList.toggle("is-error", isError);
  statusBanner.hidden = !message;
}

function showDialog(message) {
  dialogMessage.textContent = message;
  dialogLayer.hidden = false;
  dialogLayer.setAttribute("aria-hidden", "false");
}

function closeDialog() {
  dialogMessage.textContent = "";
  dialogLayer.hidden = true;
  dialogLayer.setAttribute("aria-hidden", "true");
}
