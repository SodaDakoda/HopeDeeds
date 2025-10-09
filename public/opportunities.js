const API_BASE_URL = "/api";

const opportunitiesList = document.getElementById("opportunities-list");
const opportunityCount = document.getElementById("opportunity-count");
const noResults = document.getElementById("no-results");
const statusMessage = document.getElementById("status-message");

/**
 * Render opportunity cards
 * @param {Array<object>} opportunities
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
    card.className = "opportunity-card";

    const dateStr = new Date(op.start_date).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = op.time ? op.time.substring(0, 5) : "TBD";

    card.innerHTML = `
      <h3><i class="fas fa-calendar-check"></i> ${op.title}</h3>
      <div class="opportunity-details">
        <p><strong>Date:</strong> ${dateStr}</p>
        <p><strong>Time:</strong> ${timeStr} (${op.duration || "N/A"} hrs)</p>
        <p><strong>Organization:</strong> ${op.org_id}</p>
        <div class="desc">${op.description?.substring(0, 150) || ""}${
      op.description && op.description.length > 150 ? "..." : ""
    }</div>
      </div>
      <div class="opportunity-actions">
        <button class="btn btn-secondary button" data-id="${
          op.id
        }" data-action="join">
          <i class="fas fa-user-plus"></i> Join Now
        </button>
      </div>
    `;
    opportunitiesList.appendChild(card);
  });
}

/**
 * Fetch opportunities from the server and apply frontend filters
 */
async function fetchOpportunities(filters = {}) {
  statusMessage.textContent = "Searching for opportunities...";
  opportunitiesList.innerHTML =
    '<p class="col-span-full text-center text-gray-500"><i class="fas fa-circle-notch fa-spin"></i> Loading opportunities...</p>';
  noResults.style.display = "none";

  try {
    const params = new URLSearchParams();
    if (filters.date) params.append("date", filters.date);
    if (filters.organization)
      params.append("organization", filters.organization);

    const url = `${API_BASE_URL}/opportunities?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch opportunities");
    let data = await response.json();

    // Client-side filtering for type (category)
    if (filters.type) {
      const typeFilter = filters.type.toLowerCase();
      data = data.filter((o) => o.title.toLowerCase().includes(typeFilter));
    }

    renderOpportunities(data);
    statusMessage.textContent = `Found ${data.length} opportunities.`;
  } catch (err) {
    console.error(err);
    opportunitiesList.innerHTML =
      "<p class='col-span-full text-center text-red-500'>Failed to load opportunities.</p>";
    statusMessage.textContent = `Error loading opportunities. (${err.message})`;
  }
}

/**
 * Handle Join Now button clicks (mock action)
 */
function handleJoinClick(e) {
  const button = e.target.closest("button");
  if (button && button.dataset.action === "join") {
    const oppId = button.dataset.id;
    statusMessage.textContent = `Successfully signed up for opportunity ID: ${oppId} (Mock action)`;
    button.textContent = "Signed Up!";
    button.disabled = true;
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // Filter form submission
  document
    .getElementById("opportunity-filters")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      const filters = {
        date: document.getElementById("filter-date").value,
        organization: document.getElementById("filter-organization").value,
        type: document.getElementById("filter-type").value,
      };
      fetchOpportunities(filters);
    });

  // Join Now button listener
  opportunitiesList.addEventListener("click", handleJoinClick);

  // Initial load
  fetchOpportunities();
});
