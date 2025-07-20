const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyRtHrvRaWqI5HwE33LuiHkdmsouPXEXCsvdoq0Jw_Lpr12GF3sfmza242Bg2snQN4/exec';

// *** ADMIN PASSWORD CONFIGURATION ***
const ADMIN_PASSWORD = "admin";
const ADMIN_REMEMBER_KEY = "adminLoggedIn";

let dataTableInstance = null;
let isFetchingData = false; 

// Admin password elements
const adminPasswordOverlay = document.getElementById('admin-password-overlay');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminPasswordSubmit = document.getElementById('admin-password-submit');
const adminPasswordMessage = document.getElementById('admin-password-message');
const mainContainer = document.querySelector('.container');

const logTabsDropdown = document.getElementById('logTabs'); // Already global

// NEW: Loading overlay elements
const loadingOverlay = document.getElementById('loading-overlay');
const refreshButton = document.getElementById('refreshData'); // Move global for easy access
const downloadCsvButton = document.getElementById('downloadCsv'); // Move global for easy access


// Function to show/hide admin password screen (unchanged)
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

// Check admin password (unchanged)
function checkAdminPassword() {
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        sessionStorage.setItem("adminLoggedIn", "true");
        hideAdminPasswordScreen();
        fetchAndPopulateTabs(true);
    } else {
        sessionStorage.removeItem("adminLoggedIn");
        showAdminPasswordScreen('Incorrect password.');
    }
}

// Event listeners for admin password screen (unchanged)
adminPasswordSubmit.addEventListener('click', checkAdminPassword);
adminPasswordInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        checkAdminPassword();
    }
});

// Function to fetch available log tabs and populate dropdown
async function fetchAndPopulateTabs(fetchDataImmediately = false) {
    console.log('Fetching log tabs...');
    loadingOverlay.style.display = 'flex'; // Show loading overlay
    logTabsDropdown.innerHTML = '<option value="">Loading tabs...</option>'; // Show loading state
    logTabsDropdown.disabled = true; // Disable dropdown
    refreshButton.disabled = true; // Disable refresh
    downloadCsvButton.disabled = true; // Disable download
    
    try {
        const response = await fetch(`${GOOGLE_SHEET_WEB_APP_URL}?action=getLogTabs`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Log tabs result:', result);

        if (result.logTabs && result.logTabs.length > 0) {
            logTabsDropdown.innerHTML = '';
            result.logTabs.forEach(tabName => {
                const option = document.createElement('option');
                option.value = tabName;
                option.textContent = tabName.replace('Log_', '').replace('_', '/');
                logTabsDropdown.appendChild(option);
            });
            logTabsDropdown.disabled = false;
            refreshButton.disabled = false; // Re-enable refresh
            downloadCsvButton.disabled = false; // Re-enable download
            
            if (fetchDataImmediately) {
                logTabsDropdown.value = result.logTabs[0];
                fetchAndDisplayAllData(result.logTabs[0]);
            } else {
                logTabsDropdown.value = result.logTabs[0];
                loadingOverlay.style.display = 'none'; // Hide loading overlay if not fetching data immediately
            }

        } else {
            logTabsDropdown.innerHTML = '<option value="">No logs found</option>';
            logTabsDropdown.disabled = true;
            refreshButton.disabled = true;
            downloadCsvButton.disabled = true;
            document.getElementById('loading-message').textContent = 'No monthly log tabs found in the sheet.';
            document.getElementById('loading-message').style.display = 'block';
            loadingOverlay.style.display = 'none'; // Hide loading overlay
        }
    } catch (error) {
        console.error('Error fetching log tabs:', error);
        logTabsDropdown.innerHTML = '<option value="">Error loading tabs</option>';
        logTabsDropdown.disabled = true;
        refreshButton.disabled = true;
        downloadCsvButton.disabled = true;
        document.getElementById('loading-message').textContent = 'Failed to load log tabs.';
        document.getElementById('loading-message').style.color = 'red';
        loadingOverlay.style.display = 'none'; // Hide loading overlay on error
    }
}


// This function will fetch and display all data (table only now)
async function fetchAndDisplayAllData(tabName) {
    console.log(`fetchAndDisplayAllData called for tab: ${tabName}`);
    if (isFetchingData) {
        console.warn("Already fetching data. Skipping this request.");
        return;
    }
    isFetchingData = true;

    // Show loading overlay and disable controls at the start of data fetch
    loadingOverlay.style.display = 'flex';
    logTabsDropdown.disabled = true;
    refreshButton.disabled = true;
    downloadCsvButton.disabled = true;

    const loadingMessage = document.getElementById('loading-message');
    loadingMessage.textContent = `Loading data for ${tabName.replace('Log_', '').replace('_', '/')}.`;
    loadingMessage.style.display = 'block';

    if (dataTableInstance !== null) {
        console.log('Destroying existing DataTable instance.');
        dataTableInstance.destroy();
        $('#repair-data-table').empty();
        $('#repair-data-table').append('<thead></thead><tbody></tbody>');
    }
    
    try {
        const response = await fetch(`${GOOGLE_SHEET_WEB_APP_URL}?action=getRepairData&tabName=${tabName}`);
        
        console.log('Fetch response received. Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('JSON result:', result);

        if (result.data && result.data.length > 0) {
            console.log('Data received and is not empty. Populating table.');
            const allData = result.data;
            
            const COLUMNS_ORDER = [
                'Date',
                'Mechanic Name',
                'Time Started Machine',
                'Shift',
                'Machine #',
                'Issue',
                'Description',
                'Action Taken',
                'Status',
                'Mechanic Notes'
            ];

            const columns = COLUMNS_ORDER.map(header => {
                let columnDefinition = { 
                    title: header, 
                    data: header
                };

                if (['Mechanic Name', 'Date', 'Time Started Machine', 'Shift', 'Machine #', 'Issue', 'Status'].includes(header)) {
                    columnDefinition.createdCell = function(td, cellData, rowData, row, col) {
                        $(td).css('white-space', 'nowrap');
                    };
                }

                // Formatting for Date column
                if (header === 'Date') {
                    columnDefinition.render = function(data, type, row) {
                        if (type === 'display' && data) {
                            try {
                                const date = new Date(data);
                                return date.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                });
                            }
                            catch (e) {
                                console.error("Error parsing date in DataTables render:", data, e);
                                return data;
                            }
                        }
                        return data;
                    };
                }
                // Formatting for Time Started Machine column
                if (header === 'Time Started Machine') {
                    columnDefinition.render = function(data, type, row) {
                        if (type === 'display' && data) {
                            try {
                                const date = new Date(data);
                                return date.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                });
                            }
                            catch (e) {
                                console.error("Error parsing time in DataTables render:", data, e);
                                return data;
                            }
                        }
                        return data;
                    };
                }
                
                return columnDefinition;
            });
            
            dataTableInstance = $('#repair-data-table').DataTable({
                data: allData,
                columns: columns,
                paging: true,
                ordering: true,
                info: true,
                searching: true,
                autoWidth: true,
                scrollX: false
            });

            loadingMessage.textContent = 'Data loaded successfully.';
            setTimeout(() => loadingMessage.style.display = 'none', 3000);
        } else {
            console.log('No data or empty data array received.');
            loadingMessage.textContent = `No data available for ${tabName.replace('Log_', '').replace('_', '/')}.`;
        }

    } catch (error) {
        console.error('Error fetching or processing data:', error);
        loadingMessage.textContent = 'Failed to load data. Please check console for errors.';
        loadingMessage.style.color = 'red';
    } finally {
        isFetchingData = false;
        console.log('fetchAndDisplayAllData finished. isFetchingData set to false.');
        // Re-enable controls at the very end (both success and error)
        logTabsDropdown.disabled = false;
        refreshButton.disabled = false;
        downloadCsvButton.disabled = false;
        loadingOverlay.style.display = 'none'; // Hide loading overlay
    }
}

// --- Download CSV Logic --- 
function downloadCsv() {
    if (!dataTableInstance) {
        alert('No data loaded to download!');
        return;
    }

    const COLUMNS_ORDER = [ 
        'Mechanic Name',
        'Date',
        'Time Started Machine',
        'Shift',
        'Machine #',
        'Issue',
        'Description',
        'Action Taken',
        'Status',
        'Mechanic Notes'
    ];

    const headersForCsv = COLUMNS_ORDER; 

    const data = dataTableInstance.rows({ search: 'applied', order: 'applied' }).data().toArray();
    
    if (data.length === 0) {
        alert('No data to download.');
        return;
    }

    let csvContent = headersForCsv.map(header => `"${header.replace(/"/g, '""')}"`).join(',') + '\n';
    
    data.forEach(rowData => {
        let rowArray = [];
        headersForCsv.forEach(header => {
            let value = rowData[header];

            if (header === 'Date' && value) {
                try {
                    const date = new Date(value);
                    value = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                } catch (e) {
                    // If parsing fails, use original value
                }
            } else if (header === 'Time Started Machine' && value) {
                try {
                    const date = new Date(value);
                    value = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                } catch (e) {
                    // If parsing fails, use original value
                }
            } 
            else if (header === 'Mechanic Notes' && value) {
                value = String(value).replace(/"/g, '""');
                if (value.includes(',') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            else if (header === 'Status' && value) {
                value = String(value).replace(/"/g, '""');
                if (value.includes(',') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }


            if (value === null || value === undefined) {
                value = '';
            }
            rowArray.push(`"${String(value).replace(/"/g, '""')}"`);
        });
        csvContent += rowArray.join(',') + '\n';
    });


    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'machine_repair_logs.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const adminSessionFlag = sessionStorage.getItem("adminLoggedIn");
    if (adminSessionFlag === "true") {
        hideAdminPasswordScreen();
        fetchAndPopulateTabs(true);
    } else {
        showAdminPasswordScreen(); 
        fetchAndPopulateTabs(false);
    }

    if (logTabsDropdown) { 
        logTabsDropdown.addEventListener('change', function() {
            fetchAndDisplayAllData(this.value);
        });
    }

    refreshButton.addEventListener('click', function() {
        if (logTabsDropdown && logTabsDropdown.value) {
            fetchAndDisplayAllData(logTabsDropdown.value);
        } else {
            fetchAndPopulateTabs(true);
        }
    });
    downloadCsvButton.addEventListener('click', downloadCsv);
});
