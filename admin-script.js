

const DEFAULT_DATATABLE_PAGE_LENGTH = 50; // New constant
const MESSAGE_DISPLAY_DURATION_MS = 1000; // New constant
let dataTableInstance = null;
let allLogs = [];



function getPitmanShift(dateStr, entryTime) {
    // Start of cycle: July 21, 2025, 6am is Blue Day
    const cycleStart = new Date("2025-07-21T06:00:00");
    const currentDateTime = new Date(`${dateStr}T${entryTime}`);

    if (isNaN(currentDateTime)) {
        console.warn('Invalid date/time:', dateStr, entryTime);
        return '';
    }

    // Calculate total hours since cycle start
    const diffMs = currentDateTime - cycleStart;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 0) return '';

    // Each shift is 12 hours, so each day has 2 shifts
    const shiftIndex = Math.floor(diffHours / 12);

    // The pattern for 14 shifts (7 days): [Blue Day, Blue Night, Blue Day, Blue Night, Green Day, Green Night, Green Day, Green Night, ...]
    const SHIFT_PATTERN = [
        //week 1
        "Blue Day", "Blue Night",
        "Blue Day", "Blue Night",
        "Green Day", "Green Night",
        "Green Day", "Green Night",
        "Blue Day", "Blue Night",
        "Blue Day", "Blue Night",
        "Blue Day", "Blue Night",
        //week 2
        "Green Day", "Green Night",
        "Green Day", "Green Night",
        "Blue Day", "Blue Night",
        "Blue Day", "Blue Night",
        "Green Day", "Green Night",
        "Green Day", "Green Night",
        "Green Day", "Green Night"
    ];

    // The pattern repeats every 14 shifts (7 days)
    const patternShift = SHIFT_PATTERN[shiftIndex % SHIFT_PATTERN.length];
    return patternShift;
}



async function checkAdminPassword(enteredPassword) {
  try {
    // Use modular SDK functions from window (as in your index.html)
    const docRef = window.doc(window.db, "admin", "main");
    const docSnap = await window.getDoc(docRef);
    if (!docSnap.exists()) {
      alert("Admin password not set.");
      return false;
    }
    const storedPassword = docSnap.data().password;
    return enteredPassword === storedPassword;
  } catch (e) {
    console.error("Error checking admin password:", e);
    return false;
  }
}

const adminPasswordOverlay = document.getElementById('admin-password-overlay');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminPasswordSubmit = document.getElementById('admin-password-submit');
const adminPasswordMessage = document.getElementById('admin-password-message');
const mainContainer = document.querySelector('.container');
const refreshButton = document.getElementById('refreshData');
const downloadCsvButton = document.getElementById('downloadCsv');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const searchMachineInput = document.getElementById('search-machine');
const searchDayInput = document.getElementById('search-day');
const searchMechanicInput = document.getElementById('search-mechanic');
const searchIssueInput = document.getElementById('search-issue');
const searchShiftSelect = document.getElementById('search-shift');


// Event Listeners
searchMachineInput.addEventListener('input', applyCustomFilters);
searchDayInput.addEventListener('change', applyCustomFilters);
searchMechanicInput.addEventListener('input', applyCustomFilters);
searchIssueInput.addEventListener('input', applyCustomFilters);
searchShiftSelect.addEventListener('change', applyCustomFilters);


adminPasswordSubmit.addEventListener('click', async function () {
    const input = adminPasswordInput.value;
    const valid = await checkAdminPassword(input);
    if (valid) {
        sessionStorage.setItem("adminLoggedIn", "true");
        hideAdminPasswordScreen();
        fetchAndDisplayAllDataFromFirebase();
    } else {
        sessionStorage.removeItem("adminLoggedIn");
        showAdminPasswordScreen('Incorrect password.');
    }
});
adminPasswordInput.addEventListener('keypress', async function (event) {
    if (event.key === 'Enter') {
        const input = adminPasswordInput.value;
        const valid = await checkAdminPassword(input);
        if (valid) {
            sessionStorage.setItem("adminLoggedIn", "true");
            hideAdminPasswordScreen();
            fetchAndDisplayAllDataFromFirebase();
        } else {
            sessionStorage.removeItem("adminLoggedIn");
            showAdminPasswordScreen('Incorrect password.');
        }
    }
});
refreshButton.addEventListener('click', fetchAndDisplayAllDataFromFirebase);
downloadCsvButton.addEventListener('click', downloadCsv);

document.addEventListener('DOMContentLoaded', function () {
    const adminSessionFlag = sessionStorage.getItem("adminLoggedIn");
    if (adminSessionFlag === "true") {
        hideAdminPasswordScreen();
        fetchAndDisplayAllDataFromFirebase();
    } else {
        showAdminPasswordScreen();
    }
    
    // Initialize analytics with empty data
    updateAnalytics([]);
});

function showAdminPasswordScreen(message = '') {
    adminPasswordMessage.textContent = message;
    adminPasswordMessage.style.display = message ? 'block' : 'none';
    adminPasswordOverlay.style.display = 'flex';
    adminPasswordInput.value = '';
    adminPasswordInput.focus();
    mainContainer.style.display = 'none';
    sessionStorage.removeItem("adminLoggedIn");
}

function hideAdminPasswordScreen() {
    adminPasswordOverlay.style.display = 'none';
    mainContainer.style.display = 'block';
}



async function fetchAndDisplayAllDataFromFirebase() {
    loadingOverlay.style.display = 'flex';
    loadingMessage.textContent = 'Loading data from database...';
    loadingMessage.style.display = 'block'; // Ensure loading message is visible

    if (dataTableInstance !== null) {
        dataTableInstance.clear().destroy();
        dataTableInstance = null;
    }

    try {
        const q = window.query(
            window.collection(window.db, "repair_logs"),
            window.orderBy("timestamp", "desc")
        );

        const querySnapshot = await window.getDocs(q);
        allLogs = [];

        querySnapshot.forEach((doc) => {
            const entry = doc.data();
            entry.timestampDate = new Date(entry.timestamp);
            entry.shift = getPitmanShift(entry.date, entry.timeStartedMachine);
            console.log(entry.date, entry.timeStartedMachine, entry.shift);
            allLogs.push(entry);
        });

        setDefaultTodayIfEmpty();
        applyCustomFilters();
        updateAnalytics(allLogs);

    } catch (error) {
        console.error("Error fetching data from Firebase:", error);
        loadingMessage.textContent = 'Failed to load data.';
        loadingMessage.style.color = 'red';
    } finally {
        // loadingOverlay will be hidden by displayFilteredLogs or here if no data
        if (allLogs.length === 0) { // If no data, hide loading overlay directly
             loadingOverlay.style.display = 'none';
             // Initialize empty analytics
             updateAnalytics([]);
        }
    }
}

function setDefaultTodayIfEmpty() {
    if (!searchDayInput.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        searchDayInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

function updateAnalytics(logs) {
    console.log('Updating analytics with', logs.length, 'logs');
    updateMostActiveMechanics(logs);
    updateMostReportedProblems(logs);
    updateLogsPerDay(logs);
    updateMachinesWithMostLogs(logs);
}

function updateMostActiveMechanics(logs) {
    console.log('Updating most active mechanics');
    const mechanicCounts = {};
    logs.forEach(log => {
        if (log.mechanicName) {
            mechanicCounts[log.mechanicName] = (mechanicCounts[log.mechanicName] || 0) + 1;
        }
    });

    const sortedMechanics = Object.entries(mechanicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 7);

    const container = document.getElementById('most-active-mechanics');
    if (!container) {
        console.error('Container most-active-mechanics not found');
        return;
    }
    
    if (sortedMechanics.length === 0) {
        container.innerHTML = '<div class="analytics-item"><span class="label">No data available</span></div>';
        return;
    }

    container.innerHTML = sortedMechanics.map(([mechanic, count]) => 
        `<div class="analytics-item">
            <span class="label">${mechanic}</span>
            <span class="value">${count}</span>
        </div>`
    ).join('');
}

function updateMostReportedProblems(logs) {
    const problemCounts = {};
    logs.forEach(log => {
        if (log.issue) {
            const issue = log.issue.toLowerCase().trim();
            problemCounts[issue] = (problemCounts[issue] || 0) + 1;
        }
    });

    const sortedProblems = Object.entries(problemCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 7);

    const container = document.getElementById('most-reported-problems');
    if (sortedProblems.length === 0) {
        container.innerHTML = '<div class="analytics-item"><span class="label">No data available</span></div>';
        return;
    }

    container.innerHTML = sortedProblems.map(([problem, count]) => 
        `<div class="analytics-item">
            <span class="label">${problem.charAt(0).toUpperCase() + problem.slice(1)}</span>
            <span class="value">${count}</span>
        </div>`
    ).join('');
}

function updateLogsPerDay(logs) {
    const dateCounts = {};
    logs.forEach(log => {
        if (log.date) {
            dateCounts[log.date] = (dateCounts[log.date] || 0) + 1;
        }
    });

    const sortedDates = Object.entries(dateCounts)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .slice(0, 7);

    const container = document.getElementById('logs-per-day');
    if (sortedDates.length === 0) {
        container.innerHTML = '<div class="analytics-item"><span class="label">No data available</span></div>';
        return;
    }

    container.innerHTML = sortedDates.map(([date, count]) => {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        return `<div class="analytics-item">
            <span class="label">${formattedDate}</span>
            <span class="value">${count}</span>
        </div>`;
    }).join('');
}

function updateMachinesWithMostLogs(logs) {
    const machineCounts = {};
    logs.forEach(log => {
        if (log.machineNum) {
            const machine = `Machine ${log.machineNum}`;
            machineCounts[machine] = (machineCounts[machine] || 0) + 1;
        }
    });

    const sortedMachines = Object.entries(machineCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 7);

    const container = document.getElementById('machines-most-logs');
    if (sortedMachines.length === 0) {
        container.innerHTML = '<div class="analytics-item"><span class="label">No data available</span></div>';
        return;
    }

    container.innerHTML = sortedMachines.map(([machine, count]) => 
        `<div class="analytics-item">
            <span class="label">${machine}</span>
            <span class="value">${count}</span>
        </div>`
    ).join('');
}

function applyCustomFilters() {
    let filtered = [...allLogs];

    const machineValue = searchMachineInput.value.trim();
    if (machineValue) {
        filtered = filtered.filter(entry =>
            entry.machineNum && entry.machineNum.toString() === machineValue
        );
    }

    const dayValue = searchDayInput.value;
    if (dayValue) {
        filtered = filtered.filter(entry => entry.date === dayValue);
    }

    const mechanicValue = searchMechanicInput.value.trim().toLowerCase();
    if (mechanicValue) {
    filtered = filtered.filter(entry =>
        entry.mechanicName && entry.mechanicName.toLowerCase().includes(mechanicValue)
    );
    }
    const issueValue = searchIssueInput.value.trim().toLowerCase();
if (issueValue) {
    filtered = filtered.filter(entry =>
        entry.issue && entry.issue.toLowerCase().includes(issueValue)
    );
}

const shiftValue = searchShiftSelect.value;
if (shiftValue) {
    filtered = filtered.filter(entry => entry.shift === shiftValue);
}
    displayFilteredLogs(filtered);
    updateAnalytics(filtered);

    console.log("First filtered log:", filtered[0]);
    console.log("Available shift values:", [...new Set(filtered.map(e => e.shift))]);

}

function displayFilteredLogs(filtered) {
    const columns = [
        { title: 'Date', data: 'date', className: 'nowrap', width: '90px' },
        { title: 'Mechanic', data: 'mechanicName', className: 'nowrap', width: '100px' },
        { title: 'Time Log', data: 'timeStartedMachine', className: 'nowrap', width: '70px' },
        //{ title: 'Shift', data: 'shift', className: 'nowrap' },
        { title: 'M #', data: 'machineNum', width: '50px', className: 'text-center' },
        { title: 'Issue', data: 'issue' },
        { title: 'Description', data: 'description' },
        { title: 'Action Taken', data: 'actionTaken' },
        { title: 'Status', data: 'status', className: 'nowrap' },
        { title: 'Mechanic Notes', data: 'mechanicNotes' }
    ];

    if (dataTableInstance !== null) {
        dataTableInstance.clear().destroy();
        dataTableInstance = null;
    }

    dataTableInstance = $('#repair-data-table').DataTable({
        data: filtered,
        columns: columns,
        pageLength: DEFAULT_DATATABLE_PAGE_LENGTH,
        paging: true,
        ordering: true,
        info: true,
        searching: false,
        autoWidth: false,
        scrollX: true
    });

    loadingMessage.textContent = `${filtered.length} records displayed.`;
    loadingMessage.style.display = 'block'; // Ensure message is displayed
    loadingOverlay.style.display = 'none'; // Hide the overlay after data is displayed
    setTimeout(() => {
        loadingMessage.style.display = 'none';
        loadingMessage.textContent = ''; // Clear text after hiding
    }, MESSAGE_DISPLAY_DURATION_MS); // Using constant
}

function downloadCsv() {
    if (!dataTableInstance) {
        alert('No data loaded to download!');
        return;
    }

    const columns = [
        { label: 'Date', key: 'date' },
        { label: 'Mechanic Name', key: 'mechanicName' },
        { label: 'Time Log', key: 'timeStartedMachine' },
        { label: 'M/c #', key: 'machineNum' },
        { label: 'Issue', key: 'issue' },
        { label: 'Description', key: 'description' },
        { label: 'Action Taken', key: 'actionTaken' },
        { label: 'Status', key: 'status' },
        { label: 'Mechanic Notes', key: 'mechanicNotes' }
    ];

    // Get only the currently filtered and ordered data from DataTables
    const data = dataTableInstance.rows({ search: 'applied', order: 'applied' }).data().toArray();

    if (data.length === 0) {
        alert('No data to download.');
        return;
    }

    let csvContent = columns.map(col => col.label).join(',') + '\n';
    data.forEach(row => {
        const rowArray = columns.map(col => {
            const value = row[col.key] || '';
            // Handle commas and double quotes within values
            return `"${value.toString().replace(/"/g, '""')}"`;
        });
        csvContent += rowArray.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'machine_repair_logs.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Analytics Modal Functionality
function initializeAnalyticsModal() {
    const modal = document.getElementById('analytics-modal');
    const closeBtn = document.querySelector('.analytics-close');
    const cards = document.querySelectorAll('.analytics-card');

    // Add click event to each analytics card
    cards.forEach((card, index) => {
        card.addEventListener('click', function() {
            const title = card.querySelector('h3').textContent;
            openAnalyticsModal(title, index);
        });
    });

    // Close modal when clicking the X
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

function openAnalyticsModal(title, cardIndex) {
    const modal = document.getElementById('analytics-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalTimeSelector = document.getElementById('modal-time-selector');
    const modalChart = document.getElementById('modal-chart');
    const modalDetails = document.getElementById('modal-details');

    modalTitle.textContent = title;
    
    // Hide the time period selector
    modalTimeSelector.style.display = 'none';
    
    // Clear the chart container
    modalChart.innerHTML = '';
    
    // Function to generate chart (always use 'days' period)
    function generateChart() {
        switch(cardIndex) {
            case 0: // Most Active Mechanics
                generateMechanicsChart(modalChart, modalDetails, 'days');
                break;
            case 1: // Most Reported Problems
                generateProblemsChart(modalChart, modalDetails, 'days');
                break;
            case 2: // Log Submits Per Day
                generateDailyLogsChart(modalChart, modalDetails, 'days');
                break;
            case 3: // Machines With Most Logs
                generateMachinesChart(modalChart, modalDetails, 'days');
                break;
        }
    }
    
    // Generate chart
    generateChart();

    modal.style.display = 'block';
}

// Helper function to group logs by time period
function groupLogsByTimePeriod(logs, timePeriod) {
    const grouped = {};
    
    logs.forEach(log => {
        if (!log.date) return;
        
        const date = new Date(log.date);
        let periodKey;
        
        switch(timePeriod) {
            case 'days':
                periodKey = log.date; // Already in YYYY-MM-DD format
                break;
            case 'weeks':
                const startOfWeek = new Date(date);
                startOfWeek.setDate(date.getDate() - date.getDay());
                periodKey = `Week of ${startOfWeek.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`;
                break;
            case 'months':
                periodKey = date.toLocaleDateString('en-US', {year: 'numeric', month: 'long'});
                break;
            default:
                periodKey = log.date;
        }
        
        if (!grouped[periodKey]) grouped[periodKey] = [];
        grouped[periodKey].push(log);
    });
    
    return grouped;
}

function generateMechanicsChart(chartContainer, detailsContainer, timePeriod = 'days') {
    // Create a simple visual chart for mechanics
    const mechanicsData = {};
    const groupedData = groupLogsByTimePeriod(allLogs, timePeriod);
    
    // Calculate mechanics activity by time period
    Object.entries(groupedData).forEach(([period, logs]) => {
        logs.forEach(log => {
            const mechanic = log.mechanicName || 'Unknown';
            if (!mechanicsData[mechanic]) mechanicsData[mechanic] = {};
            mechanicsData[mechanic][period] = (mechanicsData[mechanic][period] || 0) + 1;
        });
    });

    // Get total count for each mechanic
    const mechanicTotals = {};
    Object.entries(mechanicsData).forEach(([mechanic, periods]) => {
        mechanicTotals[mechanic] = Object.values(periods).reduce((sum, count) => sum + count, 0);
    });

    const sortedMechanics = Object.entries(mechanicTotals)
        .sort((a, b) => b[1] - a[1]);

    // Vertical bar chart for mechanics with grid background
    const maxCount = sortedMechanics[0][1];
    const yAxisMax = Math.ceil(maxCount / 20) * 20; // Round up to nearest 20 for clean grid
    const gridLines = [];
    for (let i = 0; i <= yAxisMax; i += 20) {
        gridLines.push(i);
    }

    chartContainer.innerHTML = `
        <div style="width: 100%; height: 100%; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h4 style="text-align: center; margin: 0 0 20px 0; font-size: 1.3em; color: #333; font-weight: 600;">Most Active Mechanics</h4>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <div style="width: 12px; height: 12px; background: #007bff; margin-right: 8px;"></div>
                <span style="font-size: 0.9em; color: #666;">Logs Handled</span>
            </div>
            <div style="position: relative; height: 400px; background: white; border: 1px solid #e1e5e9; padding: 20px 20px 60px 60px;">
                <!-- Grid lines -->
                ${gridLines.map(value => {
                    const yPos = 340 - (value / yAxisMax) * 340; // 340px is chart height
                    return `
                        <div style="position: absolute; left: 60px; right: 20px; top: ${yPos + 20}px; height: 1px; background: #f0f0f0; z-index: 1;"></div>
                        <div style="position: absolute; left: 40px; top: ${yPos + 15}px; font-size: 0.8em; color: #666; z-index: 2;">${value}</div>
                    `;
                }).join('')}
                
                <!-- Bars -->
                <div style="position: absolute; bottom: 60px; left: 60px; right: 20px; height: 340px; display: flex; align-items: end; justify-content: space-around; z-index: 3;">
                    ${sortedMechanics.slice(0, 15).map(([mechanic, totalCount]) => {
                        const barHeight = (totalCount / yAxisMax) * 340;
                        const displayName = mechanic.length > 8 ? mechanic.substring(0, 6) + '..' : mechanic;
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; min-width: 50px; max-width: 70px;">
                                <div style="background: #007bff; width: 35px; height: ${barHeight}px; margin-bottom: 8px; position: relative; border-radius: 2px 2px 0 0;">
                                    <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 0.75em; font-weight: bold; color: #333; white-space: nowrap;">${totalCount}</div>
                                </div>
                                <div style="font-size: 0.75em; color: #666; text-align: center; word-wrap: break-word; line-height: 1.2; height: 40px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                    ${displayName}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Generate details without time period breakdown
    detailsContainer.innerHTML = sortedMechanics.map(([mechanic, totalCount]) => {
        return `
            <div class="analytics-detail-item">
                <div class="analytics-detail-label">${mechanic}</div>
                <div class="analytics-detail-value">${totalCount} logs</div>
            </div>
        `;
    }).join('');
}

function generateProblemsChart(chartContainer, detailsContainer, timePeriod = 'days') {
    const problemsData = {};
    const groupedData = groupLogsByTimePeriod(allLogs, timePeriod);
    
    // Calculate problems by time period
    Object.entries(groupedData).forEach(([period, logs]) => {
        logs.forEach(log => {
            const problem = log.issue || 'Unknown';
            if (!problemsData[problem]) problemsData[problem] = {};
            problemsData[problem][period] = (problemsData[problem][period] || 0) + 1;
        });
    });

    // Get total count for each problem
    const problemTotals = {};
    Object.entries(problemsData).forEach(([problem, periods]) => {
        problemTotals[problem] = Object.values(periods).reduce((sum, count) => sum + count, 0);
    });

    const sortedProblems = Object.entries(problemTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    // Circular progress chart for problems
    chartContainer.innerHTML = `
        <div style="width: 100%; height: 100%; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h4 style="text-align: center; margin: 0 0 30px 0; font-size: 1.3em; color: #333; font-weight: 600;">⚠️ Most Common Problems</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-height: 400px; overflow-y: auto; padding: 10px 0;">
                ${sortedProblems.map(([problem, totalCount]) => {
                    const percentage = Math.round((totalCount / sortedProblems[0][1]) * 100);
                    const circumference = 2 * Math.PI * 45;
                    const strokeDasharray = `${(percentage * circumference) / 100} ${circumference}`;
                    return `
                        <div style="display: flex; flex-direction: column; align-items: center; padding: 15px; border: 1px solid #f1f3f4; border-radius: 8px; background: #fafafa;">
                            <div style="position: relative; width: 100px; height: 100px; margin-bottom: 10px;">
                                <svg width="100" height="100" style="transform: rotate(-90deg);">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e9ecef" stroke-width="8"/>
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#28a745" stroke-width="8" 
                                            stroke-dasharray="${strokeDasharray}" stroke-dashoffset="0" stroke-linecap="round"/>
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; font-size: 1.1em; color: #28a745;">
                                    ${totalCount}
                                </div>
                            </div>
                            <div style="text-align: center; font-weight: 500; font-size: 0.9em; color: #333; word-wrap: break-word;">
                                ${problem.substring(0, 25)}${problem.length > 25 ? '...' : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    detailsContainer.innerHTML = sortedProblems.map(([problem, totalCount]) => {
        return `
            <div class="analytics-detail-item">
                <div class="analytics-detail-label">${problem}</div>
                <div class="analytics-detail-value">${totalCount} reports</div>
            </div>
        `;
    }).join('');
}

function generateDailyLogsChart(chartContainer, detailsContainer, timePeriod = 'days') {
    const groupedData = groupLogsByTimePeriod(allLogs, timePeriod);
    
    // Convert to array and sort
    const sortedPeriods = Object.entries(groupedData)
        .map(([period, logs]) => [period, logs.length])
        .sort((a, b) => {
            if (timePeriod === 'days') {
                return new Date(a[0]) - new Date(b[0]);
            }
            return a[0].localeCompare(b[0]);
        });

    // Take last 14 periods for display
    const displayData = sortedPeriods.slice(-14);

    // Area chart for daily logs
    chartContainer.innerHTML = `
        <div style="width: 100%; height: 100%; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h4 style="text-align: center; margin: 0 0 30px 0; font-size: 1.3em; color: #333; font-weight: 600;">📊 Log Submissions (Last 14 Days)</h4>
            <div style="display: flex; align-items: end; gap: 8px; height: 280px; padding: 20px; margin-top: 10px; background: linear-gradient(180deg, #fff3cd 0%, #f8f9fa 100%); border-radius: 8px; position: relative;">
                ${displayData.map(([ period, count], index) => {
                    const maxCount = Math.max(...displayData.map(d => d[1]));
                    const height = Math.max((count / maxCount) * 220, 15);
                    const displayLabel = timePeriod === 'days' 
                        ? new Date(period).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
                        : period.length > 10 ? period.substring(0, 8) + '...' : period;
                    
                    // Create area chart effect with connecting lines
                    const prevHeight = index > 0 ? Math.max((displayData[index - 1][1] / maxCount) * 220, 15) : height;
                    
                    return `
                        <div style="display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 65px; position: relative;">
                            <div style="background: linear-gradient(0deg, #ffc107, #ff8f00); width: 100%; height: ${height}px; border-radius: 6px 6px 0 0; display: flex; align-items: start; justify-content: center; padding-top: 8px; color: white; font-weight: bold; font-size: 0.85em; box-shadow: 0 2px 4px rgba(255,193,7,0.3); position: relative;">
                                ${count}
                                ${index > 0 ? `<div style="position: absolute; left: -50%; top: ${220 - prevHeight}px; width: 100%; height: 2px; background: #ff8f00; transform-origin: left; z-index: -1;"></div>` : ''}
                            </div>
                            <div style="font-size: 0.75em; margin-top: 10px; transform: rotate(-45deg); transform-origin: center; white-space: nowrap; color: #666;">
                                ${displayLabel}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    detailsContainer.innerHTML = displayData.map(([period, count]) => `
        <div class="analytics-detail-item">
            <div class="analytics-detail-label">${period}</div>
            <div class="analytics-detail-value">${count} logs</div>
        </div>
    `).join('');
}

function generateMachinesChart(chartContainer, detailsContainer, timePeriod = 'days') {
    const machineData = {};
    const groupedData = groupLogsByTimePeriod(allLogs, timePeriod);
    
    // Calculate machine issues by time period
    Object.entries(groupedData).forEach(([period, logs]) => {
        logs.forEach(log => {
            const machine = log.machineNum || 'Unknown';
            if (!machineData[machine]) machineData[machine] = {};
            machineData[machine][period] = (machineData[machine][period] || 0) + 1;
        });
    });

    // Get total count for each machine
    const machineTotals = {};
    Object.entries(machineData).forEach(([machine, periods]) => {
        machineTotals[machine] = Object.values(periods).reduce((sum, count) => sum + count, 0);
    });

    const sortedMachines = Object.entries(machineTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    // Donut chart for machines with issues
    chartContainer.innerHTML = `
        <div style="width: 100%; height: 100%; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h4 style="text-align: center; margin: 0 0 30px 0; font-size: 1.3em; color: #333; font-weight: 600;">🏭 Machines with Most Issues</h4>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 25px; max-height: 400px; overflow-y: auto; padding: 10px 0;">
                ${sortedMachines.slice(0, 6).map(([machine, totalCount]) => {
                    const percentage = Math.round((totalCount / sortedMachines[0][1]) * 100);
                    const circumference = 2 * Math.PI * 35;
                    const strokeDasharray = `${(percentage * circumference) / 100} ${circumference}`;
                    return `
                        <div style="display: flex; flex-direction: column; align-items: center; padding: 15px; border: 1px solid #f1f3f4; border-radius: 12px; background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%); min-width: 120px;">
                            <div style="position: relative; margin-bottom: 15px;">
                                <svg width="80" height="80" style="transform: rotate(-90deg);">
                                    <circle cx="40" cy="40" r="35" fill="none" stroke="#e9ecef" stroke-width="6"/>
                                    <circle cx="40" cy="40" r="25" fill="none" stroke="#f8f9fa" stroke-width="6"/>
                                    <circle cx="40" cy="40" r="35" fill="none" stroke="#dc3545" stroke-width="6" 
                                            stroke-dasharray="${strokeDasharray}" stroke-dashoffset="0" stroke-linecap="round"/>
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                    <div style="font-weight: bold; font-size: 1.1em; color: #dc3545;">${totalCount}</div>
                                    <div style="font-size: 0.7em; color: #666;">issues</div>
                                </div>
                            </div>
                            <div style="text-align: center; font-weight: 500; font-size: 0.95em; color: #333;">
                                Machine #${machine}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    detailsContainer.innerHTML = sortedMachines.map(([machine, totalCount]) => {
        return `
            <div class="analytics-detail-item">
                <div class="analytics-detail-label">Machine #${machine}</div>
                <div class="analytics-detail-value">${totalCount} issues</div>
            </div>
        `;
    }).join('');
}

// Initialize modal when DOM is loaded
$(document).ready(function() {
    initializeAnalyticsModal();
});