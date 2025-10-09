const opportunitiesList = document.getElementById("opportunities-list");
const opportunityCount = document.getElementById("opportunity-count");
const noResults = document.getElementById("no-results");
const statusMessage = document.getElementById("status-message");

async function fetchOpportunities(filters = {}) {
  statusMessage.textContent = "Loading opportunities...";
  opportunitiesList.innerHTML =
    '<p class="col-span-full text-center text-gray-500"><i class="fas fa-circle-notch fa-spin"></i> Loading opportunities...</p>';
  noResults.style.display = "none";

  try {
    const response = await fetch("/api/opportunities");
    if (!response.ok) throw new Error("Failed to fetch opportunities");
    let data = await response.json();

    // Apply frontend filtering
    if (filters.date) data = data.filter((o) => o.start_date === filters.date);
    if (filters.organization)
      data = data.filter(
        (o) =>
          o.org_id.toString() === filters.organization ||
          o.organization_email === filters.organization
      );
    if (filters.type) data = data.filter((o) => o.type === filters.type);

    opportunityCount.textContent = data.length;

    if (!data.length) {
      noResults.style.display = "block";
      opportunitiesList.innerHTML = "";
      statusMessage.textContent = "No opportunities found.";
      return;
    }

    opportunitiesList.innerHTML = "";
    data.forEach((op) => {
      const card = document.createElement("div");
      card.className = "opportunity-card";
      card.innerHTML = `
        <div>
          <h3>${op.title}</h3>
          <p>${op.description}</p>
          <p><strong>Date:</strong> ${op.start_date}</p>
        </div>
        <a href="/register.html" class="btn btn-primary">Sign Up</a>
      `;
      opportunitiesList.appendChild(card);
    });

    statusMessage.textContent = "Opportunities loaded.";
  } catch (err) {
    console.error(err);
    opportunitiesList.innerHTML =
      "<p class='col-span-full text-center text-red-500'>Failed to load opportunities.</p>";
    statusMessage.textContent = "Error loading opportunities.";
  }
}

// Filter form
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

// Initial load
window.addEventListener("DOMContentLoaded", () => fetchOpportunities());
