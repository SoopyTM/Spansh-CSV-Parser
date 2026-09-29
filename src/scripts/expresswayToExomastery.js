"use strict";

const EXPECTED_HEADERS = [
    "System Name",
    "Body Name",
    "Body Subtype",
    "Distance To Arrival",
    "Landmark Subtype",
    "Value",
    "Count",
    "Jumps"
];

const STORAGE_KEY = "spanshExomasteryCsvParserData";

const csvFileInput = document.getElementById("csvFile");
const csvTable = document.getElementById("csvTable");
const tableHead = csvTable.querySelector("thead tr");
const tableBody = csvTable.querySelector("tbody");
const status = document.getElementById("status");
const clearSavedDataButton = document.getElementById("clearSavedData");


csvFileInput.addEventListener("change", handleFileSelect);

clearSavedDataButton.addEventListener("click", clearSavedData);


loadSavedData();


/**
 * Handles the selected CSV file.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];

    clearTable();
    clearStatus();

    if (!file) {
        return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
        showError("Please select a CSV file.");
        csvFileInput.value = "";
        return;
    }

    if (file.size === 0) {
        showError("The selected CSV file is empty.");
        csvFileInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = function () {
        try {
            parseCSV(reader.result, file.name);
        } catch (error) {
            showError(error.message);
        }
    };

    reader.onerror = function () {
        showError("The CSV file could not be read.");
    };

    reader.readAsText(file);
}


/**
 * Parses the CSV text and inserts the results into the table.
 */
function parseCSV(csvText, fileName) {
    csvText = csvText.replace(/^\uFEFF/, "");

    if (!csvText.trim()) {
        throw new Error("The CSV file does not contain any data.");
    }

    const rows = parseCSVText(csvText);

    if (rows.length === 0) {
        throw new Error("No rows were found in the CSV file.");
    }

    const headers = rows[0];

    validateHeaders(headers);

    for (let i = 1; i < rows.length; i++) {
        if (rows[i].length !== EXPECTED_HEADERS.length) {
            throw new Error(
                `Invalid CSV formatting on row ${i + 1}. ` +
                `Expected ${EXPECTED_HEADERS.length} columns, ` +
                `but found ${rows[i].length}.`
            );
        }
    }

    insertHeaders(headers);

    for (let i = 1; i < rows.length; i++) {
        insertRow(rows[i], false);
    }

    saveCurrentTable(fileName);

    showSuccess(
        `Successfully loaded ${rows.length - 1} row(s) from "${fileName}".`
    );
}


/**
 * Parses CSV text.
 */
function parseCSVText(text) {
    const rows = [];
    let currentRow = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const character = text[i];
        const nextCharacter = text[i + 1];

        if (character === '"') {
            if (insideQuotes && nextCharacter === '"') {
                currentValue += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (character === "," && !insideQuotes) {
            currentRow.push(currentValue);
            currentValue = "";
        } else if (
            (character === "\n" || character === "\r") &&
            !insideQuotes
        ) {
            if (character === "\r" && nextCharacter === "\n") {
                i++;
            }

            currentRow.push(currentValue);
            currentValue = "";

            if (currentRow.some(value => value.trim() !== "")) {
                rows.push(currentRow);
            }

            currentRow = [];
        } else {
            currentValue += character;
        }
    }

    if (currentValue !== "" || currentRow.length > 0) {
        currentRow.push(currentValue);

        if (currentRow.some(value => value.trim() !== "")) {
            rows.push(currentRow);
        }
    }

    if (insideQuotes) {
        throw new Error(
            "The CSV file contains an unterminated quoted value."
        );
    }

    return rows;
}


/**
 * Checks that the CSV headers match the expected Spansh format.
 */
function validateHeaders(headers) {
    if (headers.length !== EXPECTED_HEADERS.length) {
        throw new Error(
            `Invalid CSV format. ` +
            `Expected ${EXPECTED_HEADERS.length} columns, ` +
            `but found ${headers.length}.`
        );
    }

    for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
        if (headers[i].trim() !== EXPECTED_HEADERS[i]) {
            throw new Error(
                `Invalid CSV header in column ${i + 1}. ` +
                `Expected "${EXPECTED_HEADERS[i]}", ` +
                `but found "${headers[i]}".`
            );
        }
    }
}


/**
 * Inserts the CSV headers into the table.
 */
function insertHeaders(headers) {
    tableHead.innerHTML = "";

    const checkboxHeader = document.createElement("th");
    checkboxHeader.className = "checkbox-column";

    const selectAllCheckbox = document.createElement("input");

    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.id = "selectAll";
    selectAllCheckbox.title = "Select all rows";

    selectAllCheckbox.setAttribute(
        "aria-label",
        "Select all rows"
    );

    selectAllCheckbox.addEventListener("change", function () {
        const rowCheckboxes = tableBody.querySelectorAll(
            ".row-checkbox"
        );

        rowCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });

        saveCurrentTable();
    });

    checkboxHeader.appendChild(selectAllCheckbox);
    tableHead.appendChild(checkboxHeader);

    headers.forEach(header => {
        const th = document.createElement("th");

        th.textContent = header;

        tableHead.appendChild(th);
    });
}


/**
 * Inserts one CSV data row into the table.
 *
 * restoreChecked determines whether the checkbox
 * should be restored from saved data.
 */
function insertRow(row, restoreChecked = false, checked = false) {
    const tr = document.createElement("tr");

    const checkboxCell = document.createElement("td");
    checkboxCell.className = "checkbox-column";

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.className = "row-checkbox";

    checkbox.setAttribute(
        "aria-label",
        `Select ${row[1]}`
    );

    if (restoreChecked) {
        checkbox.checked = checked;
    }

    checkbox.addEventListener("change", function () {
        updateSelectAllCheckbox();

        saveCurrentTable();
    });

    checkboxCell.appendChild(checkbox);
    tr.appendChild(checkboxCell);

    row.forEach(value => {
        const td = document.createElement("td");

        td.textContent = value;

        tr.appendChild(td);
    });

    tableBody.appendChild(tr);
}


/**
 * Updates the "select all" checkbox.
 */
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById("selectAll");

    const rowCheckboxes = tableBody.querySelectorAll(
        ".row-checkbox"
    );

    if (rowCheckboxes.length === 0) {
        return;
    }

    const checkedCount = Array.from(rowCheckboxes)
        .filter(checkbox => checkbox.checked)
        .length;

    selectAllCheckbox.checked =
        checkedCount === rowCheckboxes.length;

    selectAllCheckbox.indeterminate =
        checkedCount > 0 &&
        checkedCount < rowCheckboxes.length;
}


/**
 * Saves the current table and checkbox states
 * to localStorage.
 */
function saveCurrentTable(fileName = null) {
    try {
        const rows = [];

        const tableRows = tableBody.querySelectorAll("tr");

        tableRows.forEach(row => {
            const checkbox = row.querySelector(".row-checkbox");

            const cells = row.querySelectorAll("td");

            const values = [];

            for (let i = 1; i < cells.length; i++) {
                values.push(cells[i].textContent);
            }

            rows.push({
                values: values,
                checked: checkbox.checked
            });
        });

        const existingData = getSavedData();

        const dataToSave = {
            fileName:
                fileName !== null
                    ? fileName
                    : existingData?.fileName || "",

            headers: EXPECTED_HEADERS,

            rows: rows,

            savedAt: new Date().toISOString()
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(dataToSave)
        );

    } catch (error) {
        console.error("Could not save table:", error);

        showError(
            "The table could not be saved. Your browser may have disabled local storage."
        );
    }
}


/**
 * Loads the previous table from localStorage.
 */
function loadSavedData() {
    const savedData = getSavedData();

    if (!savedData) {
        return;
    }

    try {
        if (
            !Array.isArray(savedData.headers) ||
            savedData.headers.length !== EXPECTED_HEADERS.length
        ) {
            throw new Error("Saved data format is outdated.");
        }

        for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
            if (
                savedData.headers[i] !== EXPECTED_HEADERS[i]
            ) {
                throw new Error("Saved data format is incompatible.");
            }
        }

        if (!Array.isArray(savedData.rows)) {
            throw new Error("Saved row data is invalid.");
        }

        insertHeaders(EXPECTED_HEADERS);

        savedData.rows.forEach(savedRow => {
            insertRow(
                savedRow.values,
                true,
                savedRow.checked
            );
        });

        updateSelectAllCheckbox();

        const rowCount = savedData.rows.length;

        showSuccess(
            `Restored ${rowCount} saved row(s)` +
            (
                savedData.fileName
                    ? ` from "${savedData.fileName}".`
                    : "."
            )
        );

    } catch (error) {
        console.error("Could not restore saved data:", error);

        localStorage.removeItem(STORAGE_KEY);

        showError(
            "The previously saved data could not be restored."
        );
    }
}


/**
 * Retrieves saved data from localStorage.
 */
function getSavedData() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (!savedData) {
            return null;
        }

        return JSON.parse(savedData);

    } catch (error) {
        console.error("Could not read saved data:", error);
        return null;
    }
}


/**
 * Deletes the saved table.
 */
function clearSavedData() {
    const savedData = getSavedData();

    if (!savedData) {
        showError("There is no saved table to clear.");
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to clear the saved table and all checkbox selections?"
    );

    if (!confirmed) {
        return;
    }

    localStorage.removeItem(STORAGE_KEY);

    clearTable();
    clearStatus();

    csvFileInput.value = "";

    showSuccess("Saved table and checkbox selections have been cleared.");
}


/**
 * Removes all existing table data.
 */
function clearTable() {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
}


/**
 * Clears the status message.
 */
function clearStatus() {
    status.textContent = "";
    status.className = "status";
}


/**
 * Displays an error message.
 */
function showError(message) {
    status.textContent = `Error: ${message}`;
    status.className = "status error";
}


/**
 * Displays a success message.
 */
function showSuccess(message) {
    status.textContent = message;
    status.className = "status success";
}
