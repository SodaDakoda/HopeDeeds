// opportunities.js
const API_BASE_URL = "/api";

const opportunitiesList = document.getElementById("opportunities-list");
const opportunityCount = document.getElementById("opportunity-count");
const noResults = document.getElementById("no-results");
const statusMessage = document.getElementById("status-message");

/**
 * Render opportunity (shift) cards dynamically
 */
function renderOpportunities(opportunities) {
  opportunitiesList.innerHTML = "";
  noResults.style.display = "none";

  if (!opportunities.length) {
    noResults.style.display = "block";
    opportunityCount.textContent = 0;
    return;
  }

  opportunityCount.textContent = opportunities.length;

  opportunities.forEach((op) => {
    const card = document.createElement("div");
    card.className =
      "opportunity-card bg-white shadow-md rounded-lg p-5 border-l-4 border-blue-500 hover:shadow-lg transition-all duration-200";

    const dateStr = new Date(op.start_date).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const startTime = op.start_time ? op.start_time.substring(0, 5) : "TBD";
    const endTime = op.end_time ? op.end_time.substring(0, 5) : "";
    const duration = op.duration ? `${op.duration} hrs` : "N/A";
    const area = op.area || "General";
    const freq = op.frequency_type
      ? `${op.frequency_type}${
          op.recur_until
            ? ` (until ${new Date(op.recur_until).toLocaleDateString()})`
            : ""
        }`
      : "One-time";
    const capacity = op.max_capacity ? `${op.max_capacity} max` : "Unlimited";
    const special =
      op.special_type && op.special_type.trim() !== ""
        ? `<span class="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded ml-2">${op.special_type}</span>`
        : "";

    card.innerHTML = `
      <h3 class="text-xl font-bold text-primary mb-2 flex items-center gap-2">
        <i class="fas fa-calendar-check text-secondary"></i> ${
          op.title
        } ${special}
      </h3>

      <div class="space-y-1 text-gray-700 mb-3">
        <p><strong>Date:</strong> ${dateStr}</p>
        <p><strong>Time:</strong> ${startTime} ${
      endTime ? `- ${endTime}` : ""
    }</p>
        <p><strong>Duration:</strong> ${duration}</p>
        <p><strong>Area:</strong> ${area}</p>
        <p><strong>Schedule:</strong> ${freq}</p>
        <p><strong>Capacity:</strong> ${capacity}</p>
      </div>

      <p class="text-gray-600 mb-4">${op.description || ""}</p>

      <div class="text-right">
        <button 
          class="btn btn-secondary button px-4 py-2 rounded font-semibold hover:bg-blue-600 transition-all"
          data-id="${op.id}" 
          data-action="join">
          <i class="fas fa-user-plus"></i> Join Now
        </button>
      </div>
    `;

    opportunitiesList.appendChild(card);
  });
}

/**
 * Fetch opportunities from server with optional filters
 */
async function fetchOpportunities(filters = {}) {
  statusMessage.textContent = "Loading available opportunities...";
  opportunitiesList.innerHTML =
    '<p class="col-span-full text-center text-gray-500"><i class="fas fa-circle-notch fa-spin"></i> Fetching opportunities...</p>';
  noResults.style.display = "none";

  try {
    const params = new URLSearchParams();
    if (filters.date) params.append("date", filters.date);
    if (filters.organization)
      params.append("organization", filters.organization);
    if (filters.area) params.append("area", filters.area);
    if (filters.schedule) params.append("frequency_type", filters.schedule);

    const url = `${API_BASE_URL}/opportunities?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch opportunities");
    let data = await response.json();

    // Client-side type filtering
    if (filters.type) {
      const typeFilter = filters.type.toLowerCase();
      data = data.filter((o) => o.title.toLowerCase().includes(typeFilter));
    }

    renderOpportunities(data);
    statusMessage.textContent = `Showing ${data.length} active opportunities.`;
  } catch (err) {
    console.error(err);
    opportunitiesList.innerHTML =
      "<p class='col-span-full text-center text-red-500'>Failed to load opportunities.</p>";
    statusMessage.textContent = `Error loading opportunities. (${err.message})`;
  }
}

/**
 * Handle Join button clicks
 */
function handleJoinClick(e) {
  const button = e.target.closest("button");
  if (button && button.dataset.action === "join") {
    const oppId = button.dataset.id;
    statusMessage.textContent = `You signed up for opportunity ID: ${oppId} (Mock signup)`;
    button.textContent = "Signed Up!";
    button.disabled = true;
  }
}

/**
 * Initialize filters and event listeners
 */
document.addEventListener("DOMContentLoaded", () => {
  const filterForm = document.getElementById("opportunity-filters");

  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const filters = {
        date: document.getElementById("filter-date")?.value,
        organization: document.getElementById("filter-organization")?.value,
        type: document.getElementById("filter-type")?.value,
        area: document.getElementById("filter-area")?.value,
        schedule: document.getElementById("filter-schedule")?.value,
      };
      fetchOpportunities(filters);
    });
  }

  opportunitiesList.addEventListener("click", handleJoinClick);
  fetchOpportunities();
});
