// organization_dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helpers
const getOpportunitiesCollectionRef = () =>
  collection(db, "organizations_opportunities");

// ---------- Load Org Profile ----------
async function loadOrganizationProfile(email) {
  try {
    const res = await fetch(`/api/organization/${encodeURIComponent(email)}`);
    const org = await res.json();

    document.getElementById("data-org-name").textContent =
      org.org_name || "N/A";
    document.getElementById("data-email").textContent = org.email || "N/A";
    document.getElementById("data-phone").textContent = org.phone || "N/A";
    document.getElementById("data-address").textContent = org.address || "N/A";
    document.getElementById(
      "welcome-message"
    ).textContent = `Welcome, ${org.org_name}!`;

    return org;
  } catch (err) {
    console.error("Failed to load org:", err);
    document.getElementById("welcome-message").textContent =
      "Error loading profile.";
  }
}

// ---------- Load Opportunities (Real-Time from Firebase) ----------
function loadOpportunitiesRealtime() {
  const listEl = document.getElementById("org-opportunities-list");
  const totalEl = document.getElementById("data-opportunities");

  onSnapshot(getOpportunitiesCollectionRef(), (snapshot) => {
    listEl.innerHTML = "";
    let count = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${data.title} - ${data.date} (${data.time})</span>
        <button data-id="${docSnap.id}" class="delete-btn">Delete</button>
      `;
      listEl.appendChild(li);
      count++;
    });

    totalEl.textContent = count;

    // Attach Delete listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const oppId = btn.dataset.id;

        // Delete from Node.js API
        await fetch(`/api/opportunities/${oppId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: window.currentOrgId }),
        });

        // Delete from Firebase
        await deleteDoc(doc(getOpportunitiesCollectionRef(), oppId));
      });
    });
  });
}

// ---------- Add Opportunity ----------
async function handleAddOpportunity(e, orgId) {
  e.preventDefault();

  const title = document.getElementById("opportunity-title").value;
  const date = document.getElementById("opportunity-date").value;
  const time = document.getElementById("opportunity-time").value;
  const description = document.getElementById("opportunity-description").value;

  if (!title || !date || !time || !description) {
    alert("All fields are required.");
    return;
  }

  // 1️⃣ Add to Node.js API
  const res = await fetch(
    `/api/org/${encodeURIComponent(orgId)}/opportunities`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, date, time, description }),
    }
  );

  const newOpp = await res.json();

  // 2️⃣ Mirror to Firebase
  await addDoc(getOpportunitiesCollectionRef(), { ...newOpp, orgId });
}

// ---------- Initialize Dashboard ----------
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get("email");
  if (!email) return alert("No email provided.");

  const org = await loadOrganizationProfile(email);
  window.currentOrgId = org.id;

  loadOpportunitiesRealtime();

  document
    .getElementById("new-opportunity-form")
    .addEventListener("submit", (e) => handleAddOpportunity(e, org.id));
});
