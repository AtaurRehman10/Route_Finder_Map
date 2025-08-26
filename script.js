// --- ENHANCED CONFIGURATION ---
const THEME_CONFIGS = {
  dark: [
    {
      featureType: "all",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative",
      elementType: "geometry",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#212121" }],
    },
    {
      featureType: "poi",
      elementType: "all",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      elementType: "all",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#1a1a1a", lightness: 17 }],
    },
  ],
};

const ROUTE_COLORS = {
  DRIVING: "#6366f1",
  WALKING: "#10b981",
  TRANSIT: "#f59e0b",
  BICYCLING: "#8b5cf6",
};

// --- GLOBALS ---
let map, directionsService, directionsRenderer;
let startAutocomplete, endAutocomplete;
let startPlace, endPlace;
let startMarker, endMarker;
let routePolyline;
let currentTravelMode = "DRIVING";
let isMapInitialized = false;

// --- INITIALIZE MAP ---
function initMap() {
  const mapOptions = {
    center: { lat: 30.3753, lng: 69.3451 },
    zoom: 6,
    mapTypeId: "roadmap",
    disableDefaultUI: true,
    styles: THEME_CONFIGS.dark,
    gestureHandling: "greedy",
    backgroundColor: "#0f172a",
  };

  map = new google.maps.Map(document.getElementById("map"), mapOptions);
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    suppressPolylines: true,
    map: null,
  });

  setupAutocomplete();
  setupEventListeners();
  isMapInitialized = true;
}

// --- SETUP AUTOCOMPLETE ---
function setupAutocomplete() {
  const autocompleteOptions = {
    types: ["geocode"],
    fields: ["geometry", "name", "formatted_address"],
  };

  startAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("start"),
    autocompleteOptions
  );
  endAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("end"),
    autocompleteOptions
  );

  startAutocomplete.addListener("place_changed", () => {
    startPlace = startAutocomplete.getPlace();
    validateInputs();
  });

  endAutocomplete.addListener("place_changed", () => {
    endPlace = endAutocomplete.getPlace();
    validateInputs();
  });
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  // Travel mode buttons
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelector(".mode-btn.active")
        .classList.remove("active");
      btn.classList.add("active");
      currentTravelMode = btn.dataset.mode;
      if (startPlace && endPlace) {
        displayRoute();
      }
    });
  });

  // Map controls
  document
    .getElementById("recenter-btn")
    .addEventListener("click", () => {
      if (routePolyline) {
        const bounds = new google.maps.LatLngBounds();
        routePolyline.getPath().forEach((point) => bounds.extend(point));
        map.fitBounds(bounds);
      }
    });

  document
    .getElementById("satellite-btn")
    .addEventListener("click", () => {
      const currentType = map.getMapTypeId();
      map.setMapTypeId(
        currentType === "satellite" ? "roadmap" : "satellite"
      );
    });

  document
    .getElementById("fullscreen-btn")
    .addEventListener("click", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    });
}

// --- VALIDATE INPUTS ---
function validateInputs() {
  const errorMsg = document.getElementById("error-msg");
  errorMsg.style.display = "none";

  if (!startPlace || !startPlace.geometry) {
    showError(
      "Please select a valid starting location from the suggestions."
    );
    return false;
  }
  if (!endPlace || !endPlace.geometry) {
    showError("Please select a valid destination from the suggestions.");
    return false;
  }
  return true;
}

// --- SHOW ERROR ---
function showError(message) {
  const errorMsg = document.getElementById("error-msg");
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

// --- SHOW LOADER ---
function showLoader() {
  const infoPanel = document.getElementById("info-panel");
  infoPanel.innerHTML = `
    <div class="loader-container">
      <div class="spinner"></div>
      <div class="loader-text">Calculating optimal route...</div>
    </div>
  `;
}

// --- CLEAR MAP ---
function clearMap() {
  if (startMarker) {
    startMarker.setMap(null);
    startMarker = null;
  }
  if (endMarker) {
    endMarker.setMap(null);
    endMarker = null;
  }
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }
}

// --- CREATE CUSTOM MARKER ---
function createCustomMarker(position, type) {
  const colors = {
    start: "#10b981",
    end: "#ef4444",
  };

  const marker = new google.maps.Marker({
    position: position,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: colors[type],
      fillOpacity: 1,
      strokeWeight: 3,
      strokeColor: "#ffffff",
      strokeOpacity: 1,
    },
    title: type === "start" ? "Starting Point" : "Destination",
  });

  // Add pulsing animation
  const pulseMarker = new google.maps.Marker({
    position: position,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 20,
      fillColor: colors[type],
      fillOpacity: 0.2,
      strokeWeight: 0,
    },
    zIndex: marker.getZIndex() - 1,
  });

  return marker;
}

// --- DISPLAY ROUTE ---
function displayRoute() {
  if (!isMapInitialized) return;

  showLoader();
  clearMap();

  const request = {
    origin: startPlace.geometry.location,
    destination: endPlace.geometry.location,
    travelMode: google.maps.TravelMode[currentTravelMode],
    avoidHighways: false,
    avoidTolls: false,
  };

  directionsService.route(request, (result, status) => {
    const infoPanel = document.getElementById("info-panel");

    if (status !== "OK" || !result.routes.length) {
      infoPanel.innerHTML = `
        <div class="info-content">
          <div style="color: var(--error-color); text-align: center; font-weight: 500;">
            ❌ Route not found. Please try different locations or travel mode.
          </div>
        </div>
      `;
      return;
    }

    const route = result.routes[0];
    const leg = route.legs[0];

    // Draw route polyline
    routePolyline = new google.maps.Polyline({
      path: route.overview_path,
      strokeColor: ROUTE_COLORS[currentTravelMode],
      strokeOpacity: 0.8,
      strokeWeight: 6,
      map: map,
    });

    // Add route outline for better visibility
    const outlinePolyline = new google.maps.Polyline({
      path: route.overview_path,
      strokeColor: "#ffffff",
      strokeOpacity: 0.3,
      strokeWeight: 8,
      map: map,
      zIndex: routePolyline.zIndex - 1,
    });

    // Create markers
    startMarker = createCustomMarker(route.overview_path[0], "start");
    endMarker = createCustomMarker(
      route.overview_path[route.overview_path.length - 1],
      "end"
    );

    // Fit map to route
    const bounds = new google.maps.LatLngBounds();
    route.overview_path.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds);

    // Display route information
    const distance = leg.distance ? leg.distance.text : "N/A";
    const duration = leg.duration ? leg.duration.text : "N/A";
    const durationInTraffic = leg.duration_in_traffic
      ? leg.duration_in_traffic.text
      : null;

    infoPanel.innerHTML = `
      <div class="info-content">
        <div class="route-stats">
          <div class="stat-item">
            <span class="stat-label">📏 Distance</span>
            <span class="stat-value">${distance}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">⏱️ Duration</span>
            <span class="stat-value">${duration}</span>
          </div>
          ${
            durationInTraffic
              ? `
            <div class="stat-item">
              <span class="stat-label">🚦 With Traffic</span>
              <span class="stat-value">${durationInTraffic}</span>
            </div>
          `
              : ""
          }
          <div class="stat-item">
            <span class="stat-label">🚀 Travel Mode</span>
            <span class="stat-value">${currentTravelMode
              .toLowerCase()
              .replace("_", " ")}</span>
          </div>
        </div>
      </div>
    `;
  });
}

// --- FORM HANDLING ---
document.addEventListener("DOMContentLoaded", () => {
  initMap();

  document
    .getElementById("route-form")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      if (validateInputs()) {
        displayRoute();
      }
    });
});

// --- ERROR HANDLING ---
window.addEventListener("error", (e) => {
  console.error("Application error:", e);
  document.getElementById("info-panel").innerHTML = `
    <div class="info-content">
      <div style="color: var(--error-color); text-align: center;">
        ⚠️ An unexpected error occurred. Please reload the page.
      </div>
    </div>
  `;
});

// Ensure Google Maps loads properly
window.initMap = initMap;