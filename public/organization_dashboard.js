// organization_dashboard.js

// ---------- Helpers ----------
const orgOpportunitiesList = document.getElementById("org-opportunities-list");
const orgOpportunityCount = document.getElementById("data-opportunities");
const statusMessage = document.getElementById("status-message");

// ---------- Load Organization Profile ----------
async function loadOrganizationProfile(email) {
  try {
    const res = await fetch(`/api/organization/${encodeURIComponent(email)}`);
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

    const allOpportunities = await res.json();
    const orgOpportunities = allOpportunities.filter(
      (o) => o.org_id.toString() === window.currentOrgId.toString()
    );

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
      li.innerHTML = `
        <span><strong>${op.title}</strong> - ${op.start_date} (${op.time})</span>
        <button data-id="${op.id}" class="btn btn-secondary btn-sm delete-btn">Delete</button>
      `;
      orgOpportunitiesList.appendChild(li);
    });

    // Attach delete listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const oppId = btn.dataset.id;
        if (!confirm("Are you sure you want to delete this opportunity?"))
          return;

        const delRes = await fetch(`/api/opportunities/${oppId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: window.currentOrgId }),
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
    const res = await fetch(`/api/org/${window.currentOrgId}/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Failed to post opportunity");

    // Clear form
    e.target.reset();
    statusMessage.textContent = "Opportunity added successfully.";

    // Reload opportunities
    loadOpportunities();
  } catch (err) {
    console.error(err);
    statusMessage.textContent = "Error posting opportunity.";
  }
}

// ---------- Initialize Dashboard ----------
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get("email");
  if (!email) return alert("No email provided.");

  await loadOrganizationProfile(email);
  await loadOpportunities();

  document
    .getElementById("new-opportunity-form")
    .addEventListener("submit", handleAddOpportunity);
});
