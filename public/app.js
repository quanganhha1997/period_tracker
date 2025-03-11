let currentUser = null;
// Initialize current month and year to today's date
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth(); // 0-indexed
function clearOnLogout() {
  localStorage.clear();
  console.log("LocalStorage cleared.");
}
///////////////////////////////////
// Function to display patients if the user is a doctor
// Function to display patients for doctors and admins
function displayPatientsForDoctor() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    let displaySwitch = "none";
    if(currentUser.role === "admin")displaySwitch="block"
    if (currentUser && (currentUser.role === "doctor" || currentUser.role === "admin")) {
        document.getElementById("patients-section").style.display = "block";
        document.getElementById("app").style.display = displaySwitch; // Hide main app

        const patients = JSON.parse(localStorage.getItem("patients")) || [];
        const patientsTable = document.getElementById("patients-table-body");

        patientsTable.innerHTML = ""; // Clear previous data

        patients.forEach(patient => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${patient.first_name}</td>
                <td>${patient.last_name}</td>
                <td>${patient.ssn}</td>
                <td>${patient.body_temperature}°F</td>
                <td>${patient.body_weight} lbs</td>
                <td>${patient.height} inches</td>
                <td>${new Date(patient.cycle_start).toLocaleDateString()}</td>
                <td>${new Date(patient.cycle_end).toLocaleDateString()}</td>
                <td>${patient.cycle_length} days</td>
                <td>${new Date(patient.ovulation_date).toLocaleDateString()}</td>
                <td>${patient.pregnancy ? "Yes" : "No"}</td>
            `;
            patientsTable.appendChild(row);
        });
    } else {
        document.getElementById("patients-section").style.display = "none";
    }
}
// Function to watch for `currentUser` changes in `localStorage`
function watchLocalStorageChange() {
    setInterval(() => {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (currentUser) {
            displayPatientsForDoctor();
        }
    }, 1000); // Check every second (adjust as needed)
}

// Start watching `localStorage` for changes
watchLocalStorageChange();

document.addEventListener("DOMContentLoaded", () => {
    displayLegendIfNeeded();
});

//////////////////////////////////
function displayLoggedInUser() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser && currentUser.role) { 
        document.getElementById("loggedInUser").textContent = `Welcome, ${currentUser.role}!`;
        document.getElementById("loggedInUser").style.display = "block";
    } else {
        document.getElementById("loggedInUser").style.display = "none";
    }
}

// Fetch users from the database and log them to the console
document.addEventListener("DOMContentLoaded", function() {
    fetch("/api/users")
      .then(response => response.json())
      .then(data => {
        localStorage.setItem("users", JSON.stringify(data));
        console.log("users", data);
      });

    // Fetch patients from the database and log them to the console
    fetch("/api/patients")
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        localStorage.setItem("patients", JSON.stringify(data));
        console.log("Patients fetched:", data);
    })
    .catch(error => console.error("Error fetching patients:", error));

    // Show/hide password field based on selected role.
    document.getElementById("role").addEventListener("change", function() {
      if (this.value === "user" ||this.value === "doctor" || this.value === "admin") {
        document.getElementById("passwordField").style.display = "block";
      } else {
        document.getElementById("passwordField").style.display = "none";
      }
    });
    
    // Initialize calendar when DOM is loaded
    updateCalendar();
});

function displayLegendIfNeeded() {
    const currentUser = localStorage.getItem("currentUser");
    console.log("currentUser LOCAL STORAGE", currentUser);
    if (currentUser) {
        const user = JSON.parse(currentUser);
        if (user.role === "user" || user.role === "partner"|| user.role === "admin") {
            document.getElementById("legend").style.display = "flex"; // Show for users only
        } else {
            document.getElementById("legend").style.display = "none"; // Hide for other roles
        }
    } else {
        document.getElementById("legend").style.display = "none"; // Hide if no user is logged in
    }
}

async function login() {
    const role = document.getElementById("role").value;
    const payload = { role };

    if (role === "user" || role === "doctor" || role === "admin") {
        payload.password = document.getElementById("password").value;
    }

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
        console.log("Logged in as", data);
        currentUser = data;
        localStorage.setItem("currentUser", JSON.stringify(data.user));

        // Clear password input after login
        document.getElementById("password").value = "";
        document.getElementById("login-section").style.display = "none";
        document.getElementById("menu").style.display = "flex";

        // Admin Access: Hide Patient Section
        if (currentUser.user.role === "admin") {
          document.getElementById("patients-section").style.display = "block";  // Admin can see patients
          document.getElementById("app").style.display = "block";
          document.getElementById("settingsBtn").style.display = "inline-block";  // Admin sees settings
            
        } 
        // Doctor Access: Show Patient Section, Hide Main App
        else if (currentUser.user.role === "doctor") {
            document.getElementById("patients-section").style.display = "block";
            document.getElementById("app").style.display = "none";
            displayPatientsForDoctor();
        } 
        // User Access: Hide Patients, Show Main App
        else {
            document.getElementById("patients-section").style.display = "none";
            document.getElementById("app").style.display = "block";

            // Users have access to settings
            if (currentUser.user.role === "user"|| currentUser.user.role=="admin") {
                document.getElementById("settingsBtn").style.display = "inline-block";
            } else {
                document.getElementById("settingsBtn").style.display = "none";
            }
        }
        displayLegendIfNeeded() 

        displayLoggedInUser(); // Show the logged-in user's name
        showSection("tracker");
        alert("Logged in as " + role);
    } else {
        alert(data.error || "Login failed");
    }
}

async function logout() {
    // Remove the user from local storage
    localStorage.removeItem("currentUser");

    // Call the logout API
    const res = await fetch("/api/logout", { method: "POST" });
    const data = await res.json();

    // Ensure the UI resets properly
    document.getElementById("patients-section").style.display = "none";
    document.getElementById("app").style.display = "block";  // Show the main app again
    document.getElementById("menu").style.display = "none";  // Hide menu
    document.getElementById("login-section").style.display = "block"; // Show login
    document.getElementById("legend").style.display = "none"; // Hide the legend on logout
    document.getElementById("loggedInUser").style.display = "none"; // Hide username

    // Ensure all sections are hidden
    hideAllSections();

    alert("Logged out");
}

function showSection(sectionId) {
    hideAllSections();
    document.getElementById(sectionId).classList.add("active");
    if (sectionId === "logs") {
        fetchLogs();
    }
    if (sectionId === "tracker") {
        updateCalendar();
    }
}

function hideAllSections() {
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
}

async function logPeriod() {
    const date = document.getElementById("periodDate").value;
    if (!date) {
        alert("Please select a date");
        return;
    }
    const res = await fetch("/api/periods", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ date })
    });
    const data = await res.json();
    if (data.success) {
        alert("Period logged");
        updateCalendar();
        if (document.getElementById("logs").classList.contains("active")) {
        fetchLogs();
        }
    } else {
        alert(data.error);
    }
}

async function updatePermissions() {
    const partnerPermission = document.getElementById("partnerPermission").checked;
    const doctorAccessUntil = document.getElementById("doctorAccessUntil").value;
    const res = await fetch("/api/permissions", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ partnerPermission, doctorAccessUntil })
    });
    const data = await res.json();
    if (data.success) {
        alert("Permissions updated");
    } else {
        alert(data.error);
    }
}

async function fetchLogs() {
    const res = await fetch("/api/periods");
    const data = await res.json();

    const logsList = document.getElementById("logsList");
    logsList.innerHTML = "";

    if (data.logs) {
        data.logs.forEach(log => {
            const li = document.createElement("li");
            li.textContent = `Period logged on: ${new Date(log.date).toLocaleDateString()} `;

            if (currentUser && (currentUser.role === "user" || 
                (currentUser.role === "partner" && currentUser.user.partnerPermission))) {
                
                // Allow partners to see logs when permission is granted
                updateCalendarWithLog(log);
            }
            console.log("---> ",currentUser);
            if (currentUser.user.role === "user") {
                const editBtn = document.createElement("button");
                editBtn.textContent = "Edit";
                editBtn.onclick = async () => {
                    const newDate = prompt("Enter new date (YYYY-MM-DD):", log.date);
                    if (newDate) {
                        const res = await fetch(`/api/periods/${log.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ date: newDate })
                        });
                        const result = await res.json();
                        if (result.success) {
                            alert("Log updated");
                            fetchLogs();
                            updateCalendar();
                        } else {
                            alert(result.error);
                        }
                    }
                };
                li.appendChild(editBtn);

                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Delete";
                deleteBtn.onclick = async () => {
                    if (confirm("Are you sure you want to delete this log?")) {
                        const res = await fetch(`/api/periods/${log.id}`, {
                            method: "DELETE"
                        });
                        const result = await res.json();
                        if (result.success) {
                            alert("Log deleted");
                            fetchLogs();
                            updateCalendar();
                        } else {
                            alert(result.error);
                        }
                    }
                };
                li.appendChild(deleteBtn);
            }

            logsList.appendChild(li);
        });
    } else {
        logsList.textContent = "No logs available";
    }
}

async function updateCalendar() {
    const calendarDiv = document.getElementById("calendar");
    calendarDiv.innerHTML = "";

    // Update month-year label
    const monthYearLabel = document.getElementById("monthYearLabel");
    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    monthYearLabel.textContent = monthNames[currentMonth] + " " + currentYear;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Fetch period logs and normalize stored dates
    const res = await fetch("/api/periods");
    const data = await res.json();
    let periodDates = [];
    if (data.logs) {
        periodDates = data.logs.map(log => {
            let storedDate = new Date(log.date);
            return storedDate.toISOString().split("T")[0]; // Normalize to YYYY-MM-DD
        });
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const normalizedDate = date.toISOString().split("T")[0]; // Ensure the format matches stored dates

        const dayDiv = document.createElement("div");
        dayDiv.textContent = day;

        // Check if the normalized date matches any period log
        if (periodDates.includes(normalizedDate)) {
            dayDiv.classList.add("period-day");
        }

        // Ovulation day: 14 days after period start
        if (periodDates.some(d => {
            let periodStart = new Date(d);
            periodStart.setDate(periodStart.getDate() + 14);
            return periodStart.toISOString().split("T")[0] === normalizedDate;
        })) {
            dayDiv.classList.add("ovulation-day");
        }

        // Fertility window: from period start +10 days to +16 days
        if (periodDates.some(d => {
            let fertilityStart = new Date(d);
            fertilityStart.setDate(fertilityStart.getDate() + 10);
            let fertilityEnd = new Date(d);
            fertilityEnd.setDate(fertilityEnd.getDate() + 16);
            return date >= fertilityStart && date <= fertilityEnd;
        })) {
            dayDiv.classList.add("fertility-day");
        }

        calendarDiv.appendChild(dayDiv);
    }
}

function prevMonth() {
    if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
    } else {
        currentMonth--;
    }
    updateCalendar();
}

function nextMonth() {
    if (currentMonth === 11) {
        currentMonth = 0;
        currentYear++;
    } else {
        currentMonth++;
    }
    updateCalendar();
}
