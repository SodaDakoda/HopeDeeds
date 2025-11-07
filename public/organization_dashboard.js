// organization_dashboard.js

const orgOpportunitiesList = document.getElementById("org-opportunities-list");
const orgOpportunityCount = document.getElementById("data-opportunities");
const statusMessage = document.getElementById("status-message");

// ---------- Load Organization Profile ----------
async function loadOrganizationProfile() {
  try {
    const res = await fetch("/api/organization");
    if (!res.ok) throw new Error("Failed to fetch organization");
    const org = await res.json();

    document.getElementById("data-org-id").textContent = org.id;
    document.getElementById("data-org-name").textContent = org.org_name;
    document.getElementById("data-email").textContent = org.email;
    document.getElementById("data-phone").textContent = org.phone || "N/A";
    document.getElementById("data-address").textContent = org.address || "N/A";
    document.getElementById(
      "welcome-message"
    ).textContent = `Welcome, ${org.org_name}!`;

    window.currentOrgId = org.id;
    return org;
  } catch (err) {
    console.error(err);
    document.getElementById("welcome-message").textContent =
      "Error loading profile.";
  }
}

// ---------- Load Opportunities ----------
async function loadOpportunities() {
  try {
    statusMessage.textContent = "Loading opportunities...";
    const res = await fetch("/api/opportunities");
    if (!res.ok) throw new Error("Failed to fetch opportunities");

    const orgOpportunities = await res.json();
    orgOpportunitiesList.innerHTML = "";
    orgOpportunityCount.textContent = orgOpportunities.length;

    if (!orgOpportunities.length) {
      orgOpportunitiesList.innerHTML =
        "<li>No active opportunities posted yet.</li>";
      statusMessage.textContent = "No opportunities found.";
      return;
    }

    orgOpportunities.forEach((op) => {
      const li = document.createElement("li");
      li.className =
        "flex justify-between items-center py-2 border-b border-gray-200";

      // Clickable title -> opportunity details
      li.innerHTML = `
        <span>
          <a href="opportunity_details.html?id=${
            op.id
          }" class="text-blue-600 hover:underline font-semibold">
            ${op.title}
          </a>
          <span class="text-gray-600"> - ${op.start_date || "TBD"} (${
        op.time || "TBD"
      })</span>
        </span>
        <button data-id="${
          op.id
        }" class="btn btn-secondary btn-sm delete-btn bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
          <i class="fas fa-trash"></i>
        </button>
      `;
      orgOpportunitiesList.appendChild(li);
    });

    // Delete functionality
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const oppId = btn.dataset.id;
        if (!confirm("Are you sure you want to delete this opportunity?"))
          return;

        const delRes = await fetch(`/api/opportunities/${oppId}`, {
          method: "DELETE",
        });

        if (delRes.ok) {
          btn.parentElement.remove();
          orgOpportunityCount.textContent =
            parseInt(orgOpportunityCount.textContent) - 1;
          statusMessage.textContent = "Opportunity deleted.";
        } else {
          statusMessage.textContent = "Failed to delete opportunity.";
        }
      });
    });

    statusMessage.textContent = "Opportunities loaded.";
  } catch (err) {
    console.error(err);
    orgOpportunitiesList.innerHTML =
      "<li class='text-red-500'>Failed to load opportunities.</li>";
    statusMessage.textContent = "Error loading opportunities.";
  }
}

// ---------- Add New Opportunity ----------
async function handleAddOpportunity(e) {
  e.preventDefault();

  const title = document.getElementById("opportunity-title").value;
  const start_date = document.getElementById("opportunity-date").value;
  const time = document.getElementById("opportunity-time").value;
  const duration = parseFloat(
    document.getElementById("opportunity-duration").value
  );
  const description = document.getElementById("opportunity-description").value;

  if (!title || !start_date || !time || !duration || !description) {
    alert("All fields are required.");
    return;
  }

  const body = { title, start_date, time, duration, description };

  try {
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Failed to post opportunity");

    e.target.reset();
    statusMessage.textContent = "Opportunity added successfully.";
    loadOpportunities();
  } catch (err) {
    console.error(err);
    statusMessage.textContent = "Error posting opportunity.";
  }
}

// ---------- Initialize Dashboard ----------
document.addEventListener("DOMContentLoaded", async () => {
  await loadOrganizationProfile();
  await loadOpportunities();

  document
    .getElementById("new-opportunity-form")
    .addEventListener("submit", handleAddOpportunity);
});
