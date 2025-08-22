import { db } from "./firebase-init.js";
import {
    collection,
    doc,
    addDoc,
    onSnapshot,
    setDoc,
    getDocs,
    getDoc,
    query // Import query for fetching collections
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Import the membersList from the separate bandsmen-list.js file (KEEPING THIS LOCAL FOR NOW)
import { membersList } from "./bandsmen-list.js";

// --- Global variables ---
// socialMemberFees will now be populated from Firestore
let socialMemberFees = {};

// --- DOM elements ---
const pastGatheringsView = document.getElementById('past-gatherings-view');
const attendanceInputView = document.getElementById('attendance-input-view');
const newGatheringBtn = document.getElementById('new-gathering-btn');
const publishBtn = document.getElementById('publish-btn');
const buttonTreeContainer = document.getElementById('button-tree-container');
const pastGatheringsTableBody = document.getElementById('past-gatherings-table').querySelector('tbody');
const currentAttendanceTbody = document.getElementById('current-attendance-tbody');
const currentGatheringTitle = document.getElementById('current-gathering-title');
const attendeeCountDisplay = document.getElementById('attendee-count');
const totalIncomeDisplay = document.getElementById('total-income');

// --- State Variables ---
let currentEntry = {};
let currentGatheringId = '';
let currentGatheringName = '';
let attendeeEntries = [];
const gatheringsRef = collection(db, "gatherings");
const transactionsRef = collection(db, "transactions");

const fees = {
    regular: {
        sober: 5,
        non_sober: 10
    },
    social_member: {
        sober: 0,
        non_sober: 0
    },
    social_guest: {
        sober: 2.5,
        non_sober: 5
    }
};

// --- General Helper Functions ---
function escapeHtmlAttribute(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderButtonBlock(htmlContent, backCallback) {
    buttonTreeContainer.innerHTML = htmlContent;
    const backBtn = document.getElementById('back-btn'); // This ID is crucial for listener
    if (backBtn) {
        backBtn.addEventListener('click', backCallback);
    }
}

function createAttendeeRow(entry) {
    const row = document.createElement('tr');
    const typeDisplay = (entry.type === 'regular' || entry.type === 'social_guest' || entry.type === 'new_social') ?
        `${entry.type.replace('_', ' ')} (${entry.subType})` :
        `Social Member`;

    const nameDisplay = (entry.name !== 'Not in Band (NIB)' && entry.type !== 'social_member' && entry.type !== 'new_social') ?
        `${entry.name} (${entry.type === 'regular' ? 'Regular' : 'Guest'})` :
        `${entry.name} (Social Member)`;
    
    row.innerHTML = `
        <td>${typeDisplay}</td>
        <td>${nameDisplay}</td>
        <td>${entry.section || 'N/A'}</td>
        <td>${(entry.isSober) ? '✅ Yes' : '❌ No'}</td>
        <td>${entry.payment}</td>
        <td>$${(entry.amount || 0).toFixed(2)}</td>
    `;
    return row;
}

function calculateFee(memberType, feeType) {
    return fees[memberType][feeType];
}

// --- Firestore Data Fetching Functions ---
/**
 * Fetches one-time social member fees from Firestore.
 * Expects a collection named 'social_fees' with a document ID 'fees_2526'.
 */
async function fetchSocialFees() {
    // Reference the specific document for fees (e.g., 'fees_2526')
    const feesDocRef = doc(db, "social_fees", "fees_2526");
    const feesDocSnap = await getDoc(feesDocRef);

    if (feesDocSnap.exists()) {
        socialMemberFees = feesDocSnap.data();
        console.log("Social fees fetched:", socialMemberFees);
    } else {
        console.warn("Social fees document 'fees_2526' not found in Firestore. Using fallback.");
        // Provide a fallback if the document is not found
        socialMemberFees = {
            'BaseFee': 90,
            '3rd4thYear': 85,
            'Transfer': 80,
            'Sober': 70
        };
    }
}


// --- View and Button Handlers ---
function showView(viewId) {
    pastGatheringsView.style.display = 'none';
    attendanceInputView.style.display = 'none';
    document.getElementById(viewId).style.display = 'block';
}

newGatheringBtn.addEventListener('click', () => {
    const gatheringName = prompt("Enter the name for the new gathering:");
    if (gatheringName) {
        currentGatheringName = gatheringName;
        currentGatheringId = doc(gatheringsRef).id;
        currentGatheringTitle.textContent = currentGatheringName;
        resetAttendanceInput();
        showView('attendance-input-view');
        // No need to fetch bandsmen list here if it's local for now
    }
});

publishBtn.addEventListener('click', publishGathering);

function resetAttendanceInput() {
    currentEntry = {};
    attendeeEntries = [];
    renderInitialButtons();
    currentAttendanceTbody.innerHTML = '';
    updateSummaryDisplay();
    publishBtn.style.display = 'block';
}

function renderInitialButtons() {
    const buttonsHTML = `
        <button id="regular-attendee-btn" class="tracker-button" data-type="regular">Regular Attendee</button>
        <button id="social-member-btn" class="tracker-button" data-type="social_member">Social Member</button>
        <button id="new-social-member-btn" class="tracker-button" data-type="new_social">New Social Member</button>
        <button id="social-guest-btn" class="tracker-button" data-type="social_guest">Social Guest</button>
    `;
    buttonTreeContainer.innerHTML = buttonsHTML;

    document.getElementById('regular-attendee-btn').addEventListener('click', () => renderNameDropdown('regular'));
    document.getElementById('social-member-btn').addEventListener('click', () => renderNameDropdown('social_member'));
    document.getElementById('new-social-member-btn').addEventListener('click', () => renderNameDropdown('potential_social'));
    document.getElementById('social-guest-btn').addEventListener('click', () => renderNameDropdown('social_guest'));
}

function renderNameDropdown(memberType) {
    let listToRender = [];
    let defaultOptionText = "Select a name...";

    const notInBandOption = {
        name: "Not in Band (NIB)",
        first_name: "NIB",
        last_name: "NIB",
        pronoun: "they/them",
        band_year: 'N/A',
        school_year: 'N/A',
        section: 'N/A',
        colleges: ['N/A'],
        majors: ['N/A'],
        committees: ['N/A'],
        birthday: 'N/A',
        isSocialMember: false,
        isSober: false
    };

    if (memberType === 'regular') {
        listToRender = [notInBandOption, ...membersList.filter(member => !member.isSocialMember)];
    } else if (memberType === 'social_member') {
        listToRender = membersList.filter(member => member.isSocialMember);
    } else if (memberType === 'potential_social') {
        listToRender = membersList.filter(member => !member.isSocialMember);
    } else if (memberType === 'social_guest') {
        listToRender = [notInBandOption, ...membersList];
        defaultOptionText = "Select social guest name...";
    }

    const options = listToRender.map(member => `<option value="${escapeHtmlAttribute(member.name)}">${member.name} (${member.section})</option>`).join('');
    
    renderButtonBlock(`
        <select id="name-dropdown" class="name-dropdown">
            <option value="">${defaultOptionText}</option>
            ${options}
        </select>
        <button id="next-btn" class="tracker-button">Next</button>
        <button id="back-btn" class="tracker-button">Back</button>
    `, renderInitialButtons);
    
    document.getElementById('next-btn').addEventListener('click', () => {
        const selectedNameValue = document.getElementById('name-dropdown').value.trim();
        if (!selectedNameValue) {
            alert("Please select a name.");
            return;
        }

        const selectedMember = listToRender.find(m => m.name.toLowerCase() === selectedNameValue.toLowerCase());
        
        if (selectedMember) {
            currentEntry = {
                type: memberType,
                name: selectedMember.name,
                section: selectedMember.section,
                band_year: selectedMember.band_year,
                isSober: selectedMember.isSober
            };
            
            if (memberType === 'potential_social') {
                renderSocialFees();
            } else {
                renderSoberButtons(false);
            }
        } else {
            alert(`Error: Could not find a member matching "${selectedNameValue}".`);
            console.error(`Could not find member for value: "${selectedNameValue}"`);
        }
    });
}

function renderSoberButtons(isNewSocialMember) {
    const backAction = isNewSocialMember ? () => renderNameDropdown('potential_social') : renderInitialButtons;
    const promptText = isNewSocialMember ? "Is this new social member sober?" : "";
    
    const buttonsHTML = `
        <p>Selected: ${currentEntry.name}</p>
        ${promptText ? `<p>${promptText}</p>` : ''}
        <button class="tracker-button" data-sober="true">Sober</button>
        <button class="tracker-button" data-sober="false">Non-Sober</button>
        <button id="back-btn" class="tracker-button">Back</button>
    `;
    
    renderButtonBlock(buttonsHTML, backAction);

    document.querySelectorAll('button[data-sober]').forEach(button => {
        button.addEventListener('click', (event) => {
            currentEntry.isSober = event.target.dataset.sober === 'true';
            if (isNewSocialMember) {
                renderSocialFees();
            } else {
                renderPaymentButtons();
            }
        });
    });
}

function renderSocialFees() {
    let buttonsHTML = `<p>Select One-Time Social Member Fee for ${currentEntry.name}:</p>`;
    
    // Iterate through socialMemberFees (now fetched from Firestore)
    const relevantFees = Object.entries(socialMemberFees);

    relevantFees.forEach(([feeName, amount]) => {
        // Use the feeName directly as the data-fee-name since keys are assumed clean
        buttonsHTML += `<button class="tracker-button" data-fee-name="${feeName}">$${amount} (${feeName})</button>`;
    });

    buttonsHTML += `<button id="back-btn" class="tracker-button">Back</button>`;
    
    renderButtonBlock(buttonsHTML, () => renderNameDropdown('potential_social'));

    document.querySelectorAll('button[data-fee-name]').forEach(button => {
        button.addEventListener('click', (event) => {
            currentEntry.subType = event.target.dataset.feeName; // Directly use data-fee-name
            currentEntry.type = 'new_social'; 
            renderPaymentButtons();
        });
    });
}

function renderPaymentButtons() {
    const buttonsHTML = `
        <p>Payment for: ${currentEntry.name}</p>
        <div class="payment-buttons">
            <button class="tracker-button" data-payment="cash">Cash</button>
            <button class="tracker-button" data-payment="venmo">Venmo</button>
        </div>
        <button id="back-btn" class="tracker-button">Back</button>
    `;

    const backAction = currentEntry.type === 'new_social' ? renderSocialFees : () => renderSoberButtons(false);
    renderButtonBlock(buttonsHTML, backAction);
    
    document.querySelectorAll('button[data-payment]').forEach(button => {
        button.addEventListener('click', (event) => {
            currentEntry.payment = event.target.dataset.payment;
            handleFinalEntry();
        });
    });
}

function handleFinalEntry() {
    if (currentEntry.type === 'new_social') {
        // Amount is now directly from the fetched socialMemberFees
        currentEntry.amount = socialMemberFees[currentEntry.subType];
    } else {
        const feeType = currentEntry.isSober ? 'sober' : 'non_sober';
        currentEntry.amount = calculateFee(currentEntry.type, feeType);
        currentEntry.subType = feeType;
    }

    // Since bandsmen list is local for now, existingMember logic remains as is
    const memberIndex = membersList.findIndex(m => m.name.toLowerCase() === currentEntry.name.toLowerCase());
    const existingMember = memberIndex !== -1 ? membersList[memberIndex] : null;

    if (currentEntry.type === 'new_social') {
        if (existingMember) {
            existingMember.isSocialMember = true; // Update local list for current session
            currentEntry.section = existingMember.section;
            currentEntry.band_year = existingMember.band_year;
            // No Firestore update for bandsmen yet in this step
        } else {
            // This case should not happen if 'potential_social' filters correctly
            // and assumes bandsmen are pre-existing.
            console.error(`Attempted to process new social member for non-existent bandsman: ${currentEntry.name}`);
        }
    } else {
        if (existingMember) {
            currentEntry.section = existingMember.section;
            currentEntry.band_year = existingMember.band_year;
        }
    }
    
    attendeeEntries.push(currentEntry);

    addAttendeeToTable(); 
    currentEntry = {};
    renderInitialButtons();
    updateSummaryDisplay();
}

function addAttendeeToTable() {
    const row = createAttendeeRow(currentEntry);
    currentAttendanceTbody.appendChild(row);
}

async function publishGathering() {
    console.log("Attempting to publish gathering...");
    if (attendeeEntries.length === 0) {
        alert("Cannot publish an empty gathering.");
        return;
    }

    const totalIncome = attendeeEntries.reduce((sum, entry) => {
        const amount = parseFloat(entry.amount);
        return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const gatheringData = {
        name: currentGatheringName,
        date: new Date().toISOString(),
        attendees: attendeeEntries,
        totalIncome: totalIncome
    };
    await setDoc(doc(db, "gatherings", currentGatheringId), gatheringData);

    const transactionData = {
        event: currentGatheringName,
        date: new Date().toLocaleDateString('en-US'),
        amount: totalIncome,
        category: "GatheringIncome",
        description: `Income from ${currentGatheringName} attendance`
    };
    await addDoc(collection(db, "transactions"), transactionData);

    console.log("Gathering published successfully!");
    alert("Gathering published successfully!");
    showView('past-gatherings-view');
    loadPastGatherings();

    attendeeEntries = [];
}

function updateSummaryDisplay(count, income) {
    const totalCount = count || attendeeEntries.length;
    const totalIncome = income || attendeeEntries.reduce((sum, entry) => {
        const amount = parseFloat(entry.amount);
        return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    attendeeCountDisplay.textContent = totalCount;
    totalIncomeDisplay.textContent = totalIncome.toFixed(2);
}

async function loadPastGatherings() {
    pastGatheringsTableBody.innerHTML = '';
    const querySnapshot = await getDocs(gatheringsRef);
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement('tr');
        row.dataset.id = doc.id;
        row.classList.add('past-gathering-row');
        row.innerHTML = `
            <td>${data.name}</td>
            <td>${new Date(data.date).toLocaleDateString()}</td>
            <td>${data.attendees.length}</td>
            <td>$${data.totalIncome.toFixed(2)}</td>
        `;
        pastGatheringsTableBody.appendChild(row);
    });

    document.querySelectorAll('.past-gathering-row').forEach(row => {
        row.addEventListener('click', () => {
            const gatheringId = row.dataset.id;
            displayPastGathering(gatheringId);
        });
    });
}

async function displayPastGathering(gatheringId) {
    const gatheringDoc = await getDoc(doc(gatheringsRef, gatheringId));
    if (gatheringDoc.exists()) {
        const data = gatheringDoc.data();
        currentGatheringTitle.textContent = `${data.name} (Archived)`;
        currentAttendanceTbody.innerHTML = '';
        
        data.attendees.forEach(entry => {
            const row = createAttendeeRow(entry);
            currentAttendanceTbody.appendChild(row);
        });

        updateSummaryDisplay(data.attendees.length, data.totalIncome);
        publishBtn.style.display = 'none';
        renderButtonBlock(`<button id="back-btn" class="tracker-button">Back to Gatherings</button>`, () => {
            showView('past-gatherings-view');
            loadPastGatherings();
        });
        showView('attendance-input-view');
    }
}

// --- Initial setup ---
// Fetch initial data from Firestore when the application starts
showView('past-gatherings-view');
loadPastGatherings();
fetchSocialFees(); // NEW: Fetch social fees from Firestore
// bandsmenList is still loaded from local file (no fetchBandsmenList() call yet)