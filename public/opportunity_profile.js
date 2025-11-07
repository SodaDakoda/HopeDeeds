// opportunity_profile.js

async function loadOpportunity() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    alert("Missing opportunity ID.");
    return;
  }

  try {
    const res = await fetch(`/api/opportunities/${id}`);
    if (!res.ok) throw new Error("Failed to fetch opportunity details.");

    const op = await res.json();

    // Basic Info
    document.getElementById("opportunity-title").textContent = op.title;
    document.getElementById("opportunity-date").textContent =
      "📅 Date: " + new Date(op.start_date).toLocaleDateString();
    document.getElementById("opportunity-time").textContent =
      "⏰ Time: " +
      (op.start_time ? op.start_time.substring(0, 5) : "TBD") +
      (op.end_time ? " - " + op.end_time.substring(0, 5) : "");
    document.getElementById("opportunity-duration").textContent =
      "⏳ Duration: " + (op.duration ? `${op.duration} hrs` : "N/A");
    document.getElementById("opportunity-capacity").textContent =
      "👥 Max Capacity: " + (op.max_capacity || "Not specified");
    document.getElementById("opportunity-frequency").textContent =
      "🔁 Frequency: " + (op.frequency_type || "One-time");
    document.getElementById("opportunity-special").textContent =
      "⭐ Special Type: " + (op.special_type || "None");
    document.getElementById("opportunity-description").textContent =
      op.description || "No description provided.";

    // Volunteers List
    const list = document.getElementById("volunteer-list");
    list.innerHTML = "";

    if (!op.volunteers || op.volunteers.length === 0) {
      list.innerHTML =
        "<li class='py-2 text-gray-500'>No volunteers have signed up yet.</li>";
    } else {
      op.volunteers.forEach((v) => {
        const li = document.createElement("li");
        li.className = "py-3 flex justify-between items-center";
        li.innerHTML = `
          <div>
            <strong>${v.full_name}</strong><br/>
            <span class="text-gray-500">${v.email}</span>
          </div>
          <span class="text-sm ${
            v.status === "confirmed"
              ? "text-green-600"
              : v.status === "pending"
              ? "text-yellow-600"
              : "text-gray-400"
          }">${v.status || "pending"}</span>
        `;
        list.appendChild(li);
      });
    }
  } catch (err) {
    console.error(err);
    document.getElementById("opportunity-title").textContent =
      "Error loading opportunity.";
    document.getElementById("volunteer-list").innerHTML =
      "<li class='text-red-500 py-2'>Failed to load details.</li>";
  }
}

document.addEventListener("DOMContentLoaded", loadOpportunity);
