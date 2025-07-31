// --- GLOBAL VARIABLES ---
const DEFAULT_DATATABLE_PAGE_LENGTH = 50;
const MESSAGE_DISPLAY_DURATION_MS = 1000;
let dataTableInstance = null;
let allLogs = [];

// --- CHART INSTANCE VARIABLES ---
// We need to store each chart in a variable so we can destroy it later.
let mechanicChart = null;
let issueChart = null;
let dailyChart = null;
let machineLogsChart = null;
let modalChart = null; // For the modal chart

// Chart modal elements
const chartModal = document.getElementById('chart-modal');
const modalChartCanvas = document.getElementById('modal-chart-canvas');
const modalChartTitle = document.getElementById('modal-chart-title');
const closeModalButton = document.getElementById('close-chart-modal');


// --- CORE FUNCTIONS ---

function getPitmanShift(dateStr, entryTime) {
    const cycleStart = new Date("2025-07-21T06:00:00");
    const currentDateTime = new Date(`${dateStr}T${entryTime}`);

    if (isNaN(currentDateTime)) {
        console.warn('Invalid date/time:', dateStr, entryTime);
        return '';
    }

    const diffMs = currentDateTime - cycleStart;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // This function now returns nothing for past dates, which is fine.
    // If you needed it to work for past dates, the logic would need to change.
    if (diffHours < 0) return ''; 

    const shiftIndex = Math.floor(diffHours / 12);

    const SHIFT_PATTERN = [
        "Blue Day", "Blue Night", "Blue Day", "Blue Night", "Green Day", "Green Night",
        "Green Day", "Green Night", "Blue Day", "Blue Night", "Blue Day", "Blue Night",
        "Blue Day", "Blue Night", "Green Day", "Green Night", "Green Day", "Green Night",
        "Blue Day", "Blue Night", "Blue Day", "Blue Night", "Green Day", "Green Night",
        "Green Day", "Green Night", "Green Day", "Green Night"
    ];

    // Correctly calculate the index in the pattern
    const patternIndex = shiftIndex % SHIFT_PATTERN.length;
    return SHIFT_PATTERN[patternIndex];
}

async function checkAdminPassword(enteredPassword) {
    try {
        const docRef = window.doc(window.db, "admin", "main");
        const docSnap = await window.getDoc(docRef);
        if (!docSnap.exists()) {
            // Using a custom message instead of alert()
            showAdminPasswordScreen("Admin password not configured.");
            return false;
        }
        const storedPassword = docSnap.data().password;
        return enteredPassword === storedPassword;
    } catch (e) {
        console.error("Error checking admin password:", e);
        return false;
    }
}


// --- DOM ELEMENTS & EVENT LISTENERS ---

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

// Combined login handler
async function handleAdminLogin() {
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

adminPasswordSubmit.addEventListener('click', handleAdminLogin);
adminPasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') handleAdminLogin();
});

searchMachineInput.addEventListener('input', applyCustomFilters);
searchDayInput.addEventListener('change', applyCustomFilters);
searchMechanicInput.addEventListener('input', applyCustomFilters);
searchIssueInput.addEventListener('input', applyCustomFilters);
searchShiftSelect.addEventListener('change', applyCustomFilters);
refreshButton.addEventListener('click', fetchAndDisplayAllDataFromFirebase);
downloadCsvButton.addEventListener('click', downloadCsv);

// HTML Export functionality
const exportHtmlButton = document.getElementById('exportHtml');
exportHtmlButton.addEventListener('click', exportHtmlReport);

// Chart modal event listeners
document.querySelectorAll('.chart-container').forEach(container => {
    container.addEventListener('click', function() {
        const chartId = this.dataset.chart;
        openChartModal(chartId);
    });
});

closeModalButton.addEventListener('click', closeChartModal);
chartModal.addEventListener('click', function(e) {
    if (e.target === chartModal) {
        closeChartModal();
    }
});

// Keyboard support for modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && chartModal.classList.contains('show')) {
        closeChartModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem("adminLoggedIn") === "true") {
        hideAdminPasswordScreen();
        fetchAndDisplayAllDataFromFirebase();
    } else {
        showAdminPasswordScreen();
    }
});


// --- UI FUNCTIONS ---

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

function showLoadingMessage(message) {
    loadingMessage.textContent = message;
    loadingMessage.style.display = 'block';
    setTimeout(() => {
        loadingMessage.style.display = 'none';
        loadingMessage.textContent = '';
    }, MESSAGE_DISPLAY_DURATION_MS);
}


// --- DATA HANDLING ---

async function fetchAndDisplayAllDataFromFirebase() {
    loadingOverlay.style.display = 'flex';
    loadingMessage.textContent = 'Loading data from database...';
    loadingMessage.style.display = 'block';

    if (dataTableInstance) {
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
            allLogs.push(entry);
        });

        setDefaultTodayIfEmpty();
        applyCustomFilters(); // This will call displayFilteredLogs

        // Render all charts with the newly fetched data
        renderMostWorkingMechanicChart(allLogs);
        renderMostReportedProblemsChart(allLogs);
        renderLogsPerDayChart(allLogs);
        renderMachinesWithMostLogsChart(allLogs);

    } catch (error) {
        console.error("Error fetching data from Firebase:", error);
        loadingMessage.textContent = 'Failed to load data.';
        loadingMessage.style.color = 'red';
    } finally {
        if (allLogs.length === 0) {
            loadingOverlay.style.display = 'none';
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

function applyCustomFilters() {
    let filtered = [...allLogs];
    const machineValue = searchMachineInput.value.trim().toLowerCase();
    const dayValue = searchDayInput.value;
    const mechanicValue = searchMechanicInput.value.trim().toLowerCase();
    const issueValue = searchIssueInput.value.trim().toLowerCase();
    const shiftValue = searchShiftSelect.value;

    if (machineValue) filtered = filtered.filter(e => e.machineNum?.toString().toLowerCase().includes(machineValue));
    if (dayValue) filtered = filtered.filter(e => e.date === dayValue);
    if (mechanicValue) filtered = filtered.filter(e => e.mechanicName?.toLowerCase().includes(mechanicValue));
    if (issueValue) filtered = filtered.filter(e => e.issue?.toLowerCase().includes(issueValue));
    if (shiftValue) filtered = filtered.filter(e => e.shift === shiftValue);
    
    displayFilteredLogs(filtered);
}

function displayFilteredLogs(filtered) {
    const columns = [
        { title: 'Date', data: 'date', className: 'nowrap' },
        { title: 'Mechanic', data: 'mechanicName', className: 'nowrap' },
        { title: 'Time Log', data: 'timeStartedMachine', className: 'nowrap' },
        { title: 'M #', data: 'machineNum' },
        { title: 'Issue', data: 'issue' },
        { title: 'Description', data: 'description' },
        { title: 'Action Taken', data: 'actionTaken' },
        { title: 'Status', data: 'status', className: 'nowrap' },
        { title: 'Mechanic Notes', data: 'mechanicNotes' }
    ];

    if (dataTableInstance) {
        dataTableInstance.clear().destroy();
    }

    dataTableInstance = $('#repair-data-table').DataTable({
        data: filtered,
        columns: columns,
        pageLength: DEFAULT_DATATABLE_PAGE_LENGTH,
        paging: true,
        ordering: true,
        info: true,
        searching: false,
        autoWidth: true,
        scrollX: false
    });

    loadingMessage.textContent = `${filtered.length} records displayed.`;
    loadingMessage.style.display = 'block';
    loadingOverlay.style.display = 'none';
    setTimeout(() => {
        loadingMessage.style.display = 'none';
        loadingMessage.textContent = '';
    }, MESSAGE_DISPLAY_DURATION_MS);
}

function downloadCsv() {
    if (!dataTableInstance) return;
    
    const data = dataTableInstance.rows({ search: 'applied', order: 'applied' }).data().toArray();
    if (data.length === 0) {
        alert('No data to export');
        return;
    }

    showLoadingMessage('Generating Excel file...');
    
    // Generate Excel file with data only
    generateExcelReport(data);
    
    showLoadingMessage('Excel file exported successfully!');
}

function exportHtmlReport() {
    if (!dataTableInstance) return;
    
    const data = dataTableInstance.rows({ search: 'applied', order: 'applied' }).data().toArray();
    if (data.length === 0) {
        alert('No data to export');
        return;
    }

    showLoadingMessage('Generating HTML report with charts...');
    
    // Generate complete HTML report with charts and tables
    const htmlContent = generateHtmlReport(data);
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `machine_repair_report_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showLoadingMessage('HTML report exported successfully!');
}

function generateExcelReport(data) {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data for main sheet
    const wsData = data.map(row => ({
        'Date': row.date || '',
        'Mechanic Name': row.mechanicName || '',
        'Time Log': row.timeStartedMachine || '',
        'Machine #': row.machineNum || '',
        'Issue': row.issue || '',
        'Description': row.description || '',
        'Action Taken': row.actionTaken || '',
        'Status': row.status || '',
        'Mechanic Notes': row.mechanicNotes || '',
        'Shift': row.shift || ''
    }));
    
    // Create main data worksheet
    const ws1 = XLSX.utils.json_to_sheet(wsData);
    
    // Set column widths
    ws1['!cols'] = [
        { width: 12 }, // Date
        { width: 15 }, // Mechanic Name
        { width: 10 }, // Time Log
        { width: 10 }, // Machine #
        { width: 20 }, // Issue
        { width: 30 }, // Description
        { width: 30 }, // Action Taken
        { width: 12 }, // Status
        { width: 30 }, // Mechanic Notes
        { width: 12 }  // Shift
    ];
    
    // Add main sheet
    XLSX.utils.book_append_sheet(wb, ws1, "Repair Logs");
    
    // Generate summary statistics
    const summaryData = generateSummaryData(data);
    
    // Create summary worksheet
    const ws2 = XLSX.utils.json_to_sheet(summaryData.overview);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");
    
    // Create mechanic statistics worksheet
    const ws3 = XLSX.utils.json_to_sheet(summaryData.mechanicStats);
    XLSX.utils.book_append_sheet(wb, ws3, "Mechanic Stats");
    
    // Create machine statistics worksheet
    const ws4 = XLSX.utils.json_to_sheet(summaryData.machineStats);
    XLSX.utils.book_append_sheet(wb, ws4, "Machine Stats");
    
    // Create issue statistics worksheet
    const ws5 = XLSX.utils.json_to_sheet(summaryData.issueStats);
    XLSX.utils.book_append_sheet(wb, ws5, "Issue Stats");
    
    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `machine_repair_report_${currentDate}.xlsx`;
    
    // Download the file
    XLSX.writeFile(wb, filename);
}

function generateSummaryData(data) {
    // Overview statistics
    const totalRecords = data.length;
    const uniqueMechanics = new Set(data.map(r => r.mechanicName)).size;
    const uniqueMachines = new Set(data.map(r => r.machineNum)).size;
    const uniqueIssues = new Set(data.map(r => r.issue)).size;
    
    const overview = [
        { 'Metric': 'Total Records', 'Value': totalRecords },
        { 'Metric': 'Unique Mechanics', 'Value': uniqueMechanics },
        { 'Metric': 'Unique Machines', 'Value': uniqueMachines },
        { 'Metric': 'Unique Issues', 'Value': uniqueIssues },
        { 'Metric': 'Report Generated', 'Value': new Date().toLocaleString() }
    ];
    
    // Mechanic statistics
    const mechanicCounts = {};
    data.forEach(log => {
        const mechanic = log.mechanicName || 'Unknown';
        mechanicCounts[mechanic] = (mechanicCounts[mechanic] || 0) + 1;
    });
    
    const mechanicStats = Object.entries(mechanicCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
            'Mechanic Name': name,
            'Total Repairs': count,
            'Percentage': ((count / totalRecords) * 100).toFixed(1) + '%'
        }));
    
    // Machine statistics
    const machineCounts = {};
    data.forEach(log => {
        const machine = log.machineNum || 'Unknown';
        machineCounts[machine] = (machineCounts[machine] || 0) + 1;
    });
    
    const machineStats = Object.entries(machineCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([machine, count]) => ({
            'Machine #': machine,
            'Total Repairs': count,
            'Percentage': ((count / totalRecords) * 100).toFixed(1) + '%'
        }));
    
    // Issue statistics
    const issueCounts = {};
    data.forEach(log => {
        const issue = log.issue || 'Unknown';
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    
    const issueStats = Object.entries(issueCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([issue, count]) => ({
            'Issue Type': issue,
            'Total Occurrences': count,
            'Percentage': ((count / totalRecords) * 100).toFixed(1) + '%'
        }));
    
    return {
        overview,
        mechanicStats,
        machineStats,
        issueStats
    };
}

function generateHtmlReport(data) {
    const currentDate = new Date().toLocaleString();
    const totalRecords = data.length;
    
    // Generate table rows
    const tableRows = data.map(row => `
        <tr>
            <td>${row.date || ''}</td>
            <td>${row.mechanicName || ''}</td>
            <td>${row.timeStartedMachine || ''}</td>
            <td>${row.machineNum || ''}</td>
            <td>${row.issue || ''}</td>
            <td>${row.description || ''}</td>
            <td>${row.actionTaken || ''}</td>
            <td>${row.status || ''}</td>
            <td>${row.mechanicNotes || ''}</td>
        </tr>
    `).join('');

    // Generate chart data for embedded charts
    const chartData = generateChartDataForExport(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Machine Repair Log Report - ${currentDate}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-bg: #0a0e1a;
            --secondary-bg: #1a1f2e;
            --accent-blue: #00d4ff;
            --accent-orange: #ff6b35;
            --accent-green: #00ff88;
            --text-primary: #e8eaed;
            --text-secondary: #9aa0a6;
            --border-color: #3c4043;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Rajdhani', sans-serif;
            background: linear-gradient(135deg, var(--primary-bg) 0%, var(--secondary-bg) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 20px;
        }

        .report-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: rgba(26, 31, 46, 0.4);
            border-radius: 15px;
            border: 1px solid var(--border-color);
        }

        .report-header h1 {
            font-family: 'Orbitron', monospace;
            font-size: 2.5rem;
            color: var(--accent-blue);
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
            margin-bottom: 10px;
        }

        .company-branding {
            text-align: center;
            margin-bottom: 25px;
            padding: 20px 0;
            border-bottom: 1px solid rgba(0, 212, 255, 0.2);
        }

        .company-name {
            display: block;
            font-family: 'Orbitron', monospace;
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--accent-blue);
            text-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
            letter-spacing: 4px;
            margin-bottom: 8px;
            animation: professionalGlow 4s ease-in-out infinite alternate;
        }

        .company-subtitle {
            display: block;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            letter-spacing: 1.5px;
            text-transform: uppercase;
            opacity: 0.9;
            margin-bottom: 5px;
        }

        .company-tagline {
            display: block;
            font-family: 'Rajdhani', sans-serif;
            font-size: 0.85rem;
            font-weight: 400;
            color: var(--accent-orange);
            letter-spacing: 1px;
            font-style: italic;
            opacity: 0.8;
        }

        @keyframes professionalGlow {
            from {
                text-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
            }
            to {
                text-shadow: 0 0 25px rgba(0, 212, 255, 0.7), 0 0 35px rgba(0, 212, 255, 0.3);
            }
        }

        .report-info {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 20px;
            flex-wrap: wrap;
        }

        .info-item {
            text-align: center;
        }

        .info-value {
            font-size: 1.8rem;
            color: var(--accent-green);
            font-weight: 700;
        }

        .info-label {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        .charts-section {
            margin-bottom: 40px;
        }

        .section-title {
            font-family: 'Orbitron', monospace;
            font-size: 1.5rem;
            color: var(--accent-blue);
            text-align: center;
            margin-bottom: 30px;
            text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }

        .chart-container {
            background: rgba(26, 31, 46, 0.4);
            border: 1px solid var(--border-color);
            border-radius: 15px;
            padding: 20px;
            height: 300px;
        }

        .table-section {
            background: rgba(26, 31, 46, 0.4);
            border-radius: 15px;
            border: 1px solid var(--border-color);
            overflow: hidden;
        }

        .table-container {
            overflow-x: auto;
        }

        .futuristic-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-family: 'Rajdhani', sans-serif;
            color: var(--text-primary);
            background: transparent;
        }

        .futuristic-table th {
            background: linear-gradient(135deg, var(--primary-bg), var(--secondary-bg));
            color: var(--accent-blue);
            padding: 15px 10px;
            text-align: left;
            font-family: 'Orbitron', monospace;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 1rem;
            border: 1px solid var(--border-color);
            border-right: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 10;
            text-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .futuristic-table th:last-child {
            border-right: 1px solid var(--border-color);
        }

        .futuristic-table td {
            padding: 12px 10px;
            border-bottom: 1px solid var(--border-color);
            border-right: 1px solid var(--border-color);
            background: rgba(26, 31, 46, 0.3);
            transition: all 0.3s ease;
            font-size: 1.1rem;
        }

        .futuristic-table td:last-child {
            border-right: none;
        }

        .futuristic-table tr:nth-child(even) td {
            background: rgba(26, 31, 46, 0.5);
        }

        @media print {
            body { background: white; color: black; }
            .charts-grid { break-inside: avoid; }
            .table-section { break-inside: avoid; }
            .developer-credit { display: none; }
        }

        /* Developer Credit */
        .developer-credit {
            position: fixed;
            bottom: 20px;
            left: 20px;
            font-family: 'Orbitron', monospace;
            font-size: 0.75rem;
            color: var(--text-secondary);
            opacity: 0.7;
            z-index: 1000;
            transition: opacity 0.3s ease;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            transform: rotate(180deg);
        }

        .developer-credit:hover {
            opacity: 1;
        }

        .dev-text {
            color: var(--text-secondary);
            font-weight: 300;
            letter-spacing: 0.5px;
        }

        .dev-name {
            color: var(--accent-blue);
            font-weight: 700;
            letter-spacing: 2px;
            text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="report-header">
        <!-- Company Branding - Hidden for now, will reveal during presentation
        <div class="company-branding">
            <span class="company-name">PMRT-ITT</span>
            <span class="company-subtitle">Professional Machine Resource Management & IT Technologies</span>
            <span class="company-tagline">Excellence in Industrial Systems Management</span>
        </div>
        -->
        <h1>◆ MACHINE REPAIR LOG REPORT ◆</h1>
        <p style="color: var(--text-secondary); font-size: 1.1rem;">Generated on ${currentDate}</p>
        <div class="report-info">
            <div class="info-item">
                <div class="info-value">${totalRecords}</div>
                <div class="info-label">Total Records</div>
            </div>
            <div class="info-item">
                <div class="info-value">${new Set(data.map(r => r.mechanicName)).size}</div>
                <div class="info-label">Mechanics</div>
            </div>
            <div class="info-item">
                <div class="info-value">${new Set(data.map(r => r.machineNum)).size}</div>
                <div class="info-label">Machines</div>
            </div>
        </div>
    </div>

    <div class="charts-section">
        <h2 class="section-title">📊 SYSTEM ANALYTICS</h2>
        <div class="charts-grid">
            <div class="chart-container">
                <canvas id="mechanicChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="issueChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="dailyChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="machineChart"></canvas>
            </div>
        </div>
    </div>

    <div class="table-section">
        <h2 class="section-title">📋 REPAIR LOG DATA</h2>
        <div class="table-container">
            <table class="futuristic-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Mechanic Name</th>
                        <th>Time Log</th>
                        <th>M/c #</th>
                        <th>Issue</th>
                        <th>Description</th>
                        <th>Action Taken</th>
                        <th>Status</th>
                        <th>Mechanic Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Developer Credit -->
    <div class="developer-credit">
        <span class="dev-text">Developed by</span>
        <span class="dev-name">DANIIL RITENKO</span>
    </div>

    <script>
        // Chart data
        const chartData = ${JSON.stringify(chartData)};
        
        // Initialize charts
        document.addEventListener('DOMContentLoaded', function() {
            // Mechanic Chart
            new Chart(document.getElementById('mechanicChart'), {
                type: 'doughnut',
                data: {
                    labels: chartData.mechanic.labels,
                    datasets: [{
                        data: chartData.mechanic.data,
                        backgroundColor: ['#00d4ff', '#ff6b35', '#00ff88', '#ff4757', '#9c88ff', '#ffa801'],
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Repairs by Mechanic', color: '#00d4ff' },
                        legend: { labels: { color: '#e8eaed' } }
                    }
                }
            });

            // Issue Chart
            new Chart(document.getElementById('issueChart'), {
                type: 'bar',
                data: {
                    labels: chartData.issue.labels,
                    datasets: [{
                        label: 'Count',
                        data: chartData.issue.data,
                        backgroundColor: 'rgba(0, 212, 255, 0.8)',
                        borderColor: '#00d4ff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Issues by Type', color: '#00d4ff' },
                        legend: { labels: { color: '#e8eaed' } }
                    },
                    scales: {
                        y: { ticks: { color: '#e8eaed' }, grid: { color: '#3c4043' } },
                        x: { ticks: { color: '#e8eaed' }, grid: { color: '#3c4043' } }
                    }
                }
            });

            // Daily Chart
            new Chart(document.getElementById('dailyChart'), {
                type: 'line',
                data: {
                    labels: chartData.daily.labels,
                    datasets: [{
                        label: 'Daily Repairs',
                        data: chartData.daily.data,
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        borderWidth: 3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Daily Repair Trends', color: '#00d4ff' },
                        legend: { labels: { color: '#e8eaed' } }
                    },
                    scales: {
                        y: { ticks: { color: '#e8eaed' }, grid: { color: '#3c4043' } },
                        x: { ticks: { color: '#e8eaed' }, grid: { color: '#3c4043' } }
                    }
                }
            });

            // Machine Chart
            new Chart(document.getElementById('machineChart'), {
                type: 'bar',
                data: {
                    labels: chartData.machine.labels,
                    datasets: [{
                        label: 'Repairs',
                        data: chartData.machine.data,
                        backgroundColor: 'rgba(255, 107, 53, 0.8)',
                        borderColor: '#ff6b35',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Repairs by Machine', color: '#00d4ff' },
                        legend: { labels: { color: '#e8eaed' } }
                    },
                    scales: {
                        y: { ticks: { color: '#e8eaed' }, grid: { color: '#3c4043' } },
                        x: { ticks: { color: '#e8eaed' }, grid: { color: '#3c4043' } }
                    }
                }
            });
        });
    </script>
</body>
</html>`;
}

function generateChartDataForExport(data) {
    // Mechanic data
    const mechanicCounts = {};
    data.forEach(log => {
        const mechanic = log.mechanicName || 'Unknown';
        mechanicCounts[mechanic] = (mechanicCounts[mechanic] || 0) + 1;
    });

    // Issue data
    const issueCounts = {};
    data.forEach(log => {
        const issue = log.issue || 'Unknown';
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });

    // Daily data
    const dailyCounts = {};
    data.forEach(log => {
        const date = log.date || 'Unknown';
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // Machine data
    const machineCounts = {};
    data.forEach(log => {
        const machine = log.machineNum || 'Unknown';
        machineCounts[machine] = (machineCounts[machine] || 0) + 1;
    });

    return {
        mechanic: {
            labels: Object.keys(mechanicCounts),
            data: Object.values(mechanicCounts)
        },
        issue: {
            labels: Object.keys(issueCounts).slice(0, 10), // Top 10
            data: Object.values(issueCounts).slice(0, 10)
        },
        daily: {
            labels: Object.keys(dailyCounts).sort(),
            data: Object.keys(dailyCounts).sort().map(date => dailyCounts[date])
        },
        machine: {
            labels: Object.keys(machineCounts).slice(0, 10), // Top 10
            data: Object.values(machineCounts).slice(0, 10)
        }
    };
}


// --- CHART RENDERING FUNCTIONS ---

function renderMostWorkingMechanicChart(logs) {
    // **FIX:** Destroy the old chart before creating a new one.
    if (mechanicChart) {
        mechanicChart.destroy();
    }
    const mechanicCounts = {};
    logs.forEach(log => {
        const mechanic = log.mechanicName || 'Unknown';
        mechanicCounts[mechanic] = (mechanicCounts[mechanic] || 0) + 1;
    });
    const sorted = Object.entries(mechanicCounts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([_, count]) => count);
    const ctx = document.getElementById('mechanicChart').getContext('2d');
    // **FIX:** Store the new chart in our variable.
    mechanicChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Logs Handled', data, backgroundColor: '#007bff' }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Most Active Mechanics' } } }
    });
}

function renderMostReportedProblemsChart(logs) {
    // **FIX:** Destroy the old chart before creating a new one.
    if (issueChart) {
        issueChart.destroy();
    }
    const problemCounts = {};
    logs.forEach(log => {
        const problem = log.issue || 'Unknown';
        problemCounts[problem] = (problemCounts[problem] || 0) + 1;
    });
    const sorted = Object.entries(problemCounts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([_, count]) => count);
    const ctx = document.getElementById('issueChart').getContext('2d');
    // **FIX:** Store the new chart in our variable.
    issueChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Occurrences', data, backgroundColor: '#f39c12' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Most Reported Problems' } } }
    });
}

function renderLogsPerDayChart(logs) {
    // **FIX:** Destroy the old chart before creating a new one.
    if (dailyChart) {
        dailyChart.destroy();
    }
    const dayCounts = {};
    logs.forEach(log => {
        const day = log.date || 'Unknown';
        dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const sortedDays = Object.keys(dayCounts).sort();
    const data = sortedDays.map(day => dayCounts[day]);
    const ctx = document.getElementById('dailyChart').getContext('2d');
    // **FIX:** Store the new chart in our variable.
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: { labels: sortedDays, datasets: [{ label: 'Logs per Day', data, borderColor: '#2980b9', fill: false, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Logs Submitted Per Day' } } }
    });
}

function renderMachinesWithMostLogsChart(logs) {
    // **FIX:** Destroy the old chart before creating a new one.
    if (machineLogsChart) {
        machineLogsChart.destroy();
    }
    const machineCounts = {};
    logs.forEach(log => {
        const machine = log.machineNum || 'Unknown';
        machineCounts[machine] = (machineCounts[machine] || 0) + 1;
    });
    const sorted = Object.entries(machineCounts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([num]) => `Machine ${num}`);
    const data = sorted.map(([_, count]) => count);
    const ctx = document.getElementById('machineLogsChart').getContext('2d');
    // **FIX:** Store the new chart in our variable.
    machineLogsChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Log Count', data, backgroundColor: '#16a085' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Machines with Most Logs' } } }
    });
}

// --- CHART MODAL FUNCTIONS ---

function openChartModal(chartId) {
    // Set modal title based on chart
    const titles = {
        'mechanicChart': 'MOST ACTIVE MECHANICS',
        'issueChart': 'MOST REPORTED PROBLEMS', 
        'dailyChart': 'LOGS SUBMITTED PER DAY',
        'machineLogsChart': 'MACHINES WITH MOST LOGS'
    };
    
    modalChartTitle.textContent = titles[chartId] || 'CHART ANALYSIS';
    
    // Clone the chart data and create enlarged version
    let sourceChart;
    switch(chartId) {
        case 'mechanicChart':
            sourceChart = mechanicChart;
            break;
        case 'issueChart':
            sourceChart = issueChart;
            break;
        case 'dailyChart':
            sourceChart = dailyChart;
            break;
        case 'machineLogsChart':
            sourceChart = machineLogsChart;
            break;
        default:
            return;
    }
    
    if (!sourceChart) return;
    
    // Destroy existing modal chart
    if (modalChart) {
        modalChart.destroy();
    }
    
    // Get the chart data and config
    const chartData = JSON.parse(JSON.stringify(sourceChart.data));
    const chartType = sourceChart.config.type;
    
    // Create enhanced config for modal
    const modalConfig = {
        type: chartType,
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: titles[chartId],
                    font: {
                        family: 'Orbitron',
                        size: 18,
                        weight: 'bold'
                    },
                    color: '#00d4ff'
                },
                legend: {
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Rajdhani',
                            size: 14
                        }
                    }
                }
            },
            scales: chartType !== 'pie' ? {
                x: {
                    ticks: {
                        color: '#a8b2d1',
                        font: {
                            family: 'Rajdhani',
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(168, 178, 209, 0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#a8b2d1',
                        font: {
                            family: 'Rajdhani',
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(168, 178, 209, 0.1)'
                    }
                }
            } : {}
        }
    };
    
    // Enhance colors for better visibility in modal
    if (chartData.datasets) {
        chartData.datasets.forEach(dataset => {
            if (Array.isArray(dataset.backgroundColor)) {
                // Multi-color dataset (like pie charts)
                dataset.backgroundColor = [
                    '#00d4ff', '#ff6b35', '#00ff88', '#ff4757', 
                    '#9c88ff', '#ffa801', '#2ed573', '#ff6348',
                    '#70a1ff', '#5352ed', '#ff9ff3', '#54a0ff'
                ];
                dataset.borderColor = '#ffffff';
                dataset.borderWidth = 2;
            } else {
                // Single color dataset
                dataset.backgroundColor = 'rgba(0, 212, 255, 0.8)';
                dataset.borderColor = '#00d4ff';
                dataset.borderWidth = 2;
            }
        });
    }
    
    // Create the modal chart
    modalChart = new Chart(modalChartCanvas, modalConfig);
    
    // Show modal
    chartModal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeChartModal() {
    chartModal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
    
    // Destroy modal chart
    if (modalChart) {
        modalChart.destroy();
        modalChart = null;
    }
}
