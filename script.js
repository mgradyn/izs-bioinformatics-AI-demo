// Initialize Mermaid with updated configuration
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
    },
    securityLevel: 'loose',
    themeCSS: `
        .node rect, .node circle, .node ellipse, .node polygon, .node path {
            fill: #ffffff !important;
            stroke: #01679c !important;
            stroke-width: 2px !important;
        }
        
        .cluster rect {
            fill: #f2f2f3 !important;
            stroke: #015a8a !important;
            stroke-width: 1.5px !important;
        }
        
        .edgePath .path {
            stroke: #01679c !important;
            stroke-width: 2px !important;
        }
        
        .arrowheadPath {
            fill: #01679c !important;
            stroke: #01679c !important;
        }
    `
});

// DOM elements
const userInput = document.getElementById('userInput');
const generateBtn = document.getElementById('generateBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Nextflow elements
const nextflowEmpty = document.getElementById('nextflowEmpty');
const nextflowLoading = document.getElementById('nextflowLoading');
const nextflowCodeContainer = document.getElementById('nextflowCodeContainer'); // pre
const nextflowCodeBlock = document.getElementById('nextflowCodeBlock'); // code
const nextflowStatus = document.getElementById('nextflowStatus');
const copyNextflowBtn = document.getElementById('copyNextflowBtn');
const nextflowTimer = document.getElementById('nextflowTimer');

// Mermaid elements
const mermaidEmpty = document.getElementById('mermaidEmpty');
const mermaidLoading = document.getElementById('mermaidLoading');
const mermaidContainer = document.getElementById('mermaidContainer'); // Diagram Wrapper
const mermaidDiagram = document.getElementById('mermaidDiagram'); // Actual Diagram div
const mermaidCodeContainer = document.getElementById('mermaidCodeContainer'); // Code View Wrapper (pre)
const mermaidCodeBlock = document.getElementById('mermaidCodeBlock'); // Code Block (code)
const mermaidStatus = document.getElementById('mermaidStatus');
const toggleMermaidBtn = document.getElementById('toggleMermaidBtn');
const copyMermaidBtn = document.getElementById('copyMermaidBtn');
const mermaidTimer = document.getElementById('mermaidTimer');

const exampleBtns = document.querySelectorAll('.example-btn');
const apiUrl = 'https://izs-llm.me/generate';

// Drag and scale related variables
let currentScale = 1;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const SCALE_STEP = 0.2;

// Drag related variables
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let translateX = 0;
let translateY = 0;
let isPanMode = false;

// View Mode State
let isMermaidCodeView = false;

// Data Store (for copying)
let rawNextflowData = "";
let rawMermaidData = "";

// Timing
let apiStartTime = 0;
let timerInterval = null;

// --- Custom Beautifier Logic ---
function customFormat(code) {
    if (!code) return '';
    // Remove empty lines at start/end
    code = code.trim();
    
    const lines = code.split('\n');
    let indentLevel = 0;
    const indentStr = '    '; // 4 spaces
    let formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Skip completely empty lines if they are excessive
        if (line === '') {
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
                formattedLines.push('');
            }
            continue;
        }

        // Check for closing brackets to reduce indent BEFORE adding the line
        if (line.startsWith('}') || line.startsWith(']') || line.startsWith(')') || line === 'end') {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Add the line with current indent
        formattedLines.push(indentStr.repeat(indentLevel) + line);

        // Check for opening brackets to increase indent AFTER adding the line
        // Logic: Ends with { or [ or ( OR is "subgraph..." or "workflow..."
        if (
            line.endsWith('{') || 
            line.endsWith('[') || 
            line.endsWith('(') || 
            (line.includes('subgraph') && !line.includes('end')) ||
            line.includes('workflow') && line.includes('{')
        ) {
            indentLevel++;
        }
    }
    return formattedLines.join('\n');
}

// Set status
function setStatus(type, message) {
    statusDot.className = 'status-dot';
    statusDot.classList.add(type);
    statusText.textContent = message;
}

// Show error
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    setStatus('error', 'Error');
    stopTimer();
}

// Hide error
function hideError() {
    errorMessage.style.display = 'none';
}

// Reset result areas
function resetResults() {
    // Hide all content
    nextflowEmpty.style.display = 'none';
    nextflowLoading.style.display = 'none';
    nextflowCodeContainer.style.display = 'none';
    
    mermaidEmpty.style.display = 'none';
    mermaidLoading.style.display = 'none';
    mermaidContainer.style.display = 'none';
    mermaidCodeContainer.style.display = 'none';
    
    // Reset status indicators
    nextflowStatus.className = 'status-dot';
    nextflowStatus.nextElementSibling.textContent = 'Ready';
    
    mermaidStatus.className = 'status-dot';
    mermaidStatus.nextElementSibling.textContent = 'Ready';
    
    // Reset Timers visibility
    nextflowTimer.style.display = 'none';
    mermaidTimer.style.display = 'none';
    nextflowTimer.textContent = '0.0s';
    mermaidTimer.textContent = '0.0s';

    // Reset view state
    isMermaidCodeView = false;
    updateMermaidView();
    
    stopTimer();
}

// Timer Logic
function startTimer() {
    stopTimer();
    apiStartTime = Date.now();
    nextflowTimer.style.display = 'inline-block';
    mermaidTimer.style.display = 'inline-block';
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const diff = ((now - apiStartTime) / 1000).toFixed(1) + 's';
        nextflowTimer.textContent = diff;
        mermaidTimer.textContent = diff;
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Show loading state
function showLoading() {
    resetResults();
    
    nextflowLoading.style.display = 'flex';
    mermaidLoading.style.display = 'flex';
    
    nextflowStatus.className = 'status-dot active';
    nextflowStatus.nextElementSibling.textContent = 'Generating...';
    
    mermaidStatus.className = 'status-dot active';
    mermaidStatus.nextElementSibling.textContent = 'Generating...';
    
    startTimer();
}

// Show Nextflow code
function showNextflowCode(code) {
    // Beautify First
    const beautifulCode = customFormat(code);
    rawNextflowData = beautifulCode; // Store for copy
    
    nextflowLoading.style.display = 'none';
    
    // Set text and highlight
    nextflowCodeBlock.textContent = beautifulCode;
    // Force Prism to re-highlight
    Prism.highlightElement(nextflowCodeBlock);
    
    nextflowCodeContainer.style.display = 'block';
    nextflowStatus.className = 'status-dot active';
    nextflowStatus.nextElementSibling.textContent = 'Generated';
    
    // Auto scroll to top
    nextflowCodeContainer.scrollTop = 0;
}

// Toggle Mermaid View
function updateMermaidView() {
    if (isMermaidCodeView) {
        // Show Code, Hide Diagram
        mermaidContainer.style.display = 'none';
        mermaidCodeContainer.style.display = 'block';
        toggleMermaidBtn.innerHTML = '<i class="fas fa-project-diagram"></i>'; // Icon to switch back to diagram
        toggleMermaidBtn.classList.add('active');
    } else {
        // Show Diagram, Hide Code
        // Only show diagram container if we are not loading/empty
        if (mermaidLoading.style.display === 'none' && mermaidEmpty.style.display === 'none') {
            mermaidContainer.style.display = 'flex';
        }
        mermaidCodeContainer.style.display = 'none';
        toggleMermaidBtn.innerHTML = '<i class="fas fa-code"></i>'; // Icon to switch to code
        toggleMermaidBtn.classList.remove('active');
    }
}

// Copy Function
async function copyToClipboard(text, btnElement) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        const originalIcon = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fas fa-check"></i>';
        btnElement.style.color = 'var(--success)';
        btnElement.style.borderColor = 'var(--success)';
        
        setTimeout(() => {
            btnElement.innerHTML = originalIcon;
            btnElement.style.color = '';
            btnElement.style.borderColor = '';
        }, 1500);
    } catch (err) {
        console.error('Copy failed', err);
    }
}

// Generate scale toolbar
function createZoomControls() {
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    
    // Drag
    const panBtn = document.createElement('button');
    panBtn.className = 'zoom-btn pan';
    panBtn.innerHTML = '<i class="fas fa-hand-paper"></i>';
    panBtn.title = 'Drag and drop mode (spacebar)';
    panBtn.addEventListener('click', togglePanMode);
    
    // Zoom in
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'zoom-btn';
    zoomInBtn.innerHTML = '<i class="fas fa-search-plus"></i>';
    zoomInBtn.title = 'Zoom in (Ctrl + +)';
    zoomInBtn.addEventListener('click', () => zoomChart(SCALE_STEP));
    
    // Zoom out
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'zoom-btn';
    zoomOutBtn.innerHTML = '<i class="fas fa-search-minus"></i>';
    zoomOutBtn.title = 'Zoom out (Ctrl + -)';
    zoomOutBtn.addEventListener('click', () => zoomChart(-SCALE_STEP));
    
    // Reset
    const resetBtn = document.createElement('button');
    resetBtn.className = 'zoom-btn reset';
    resetBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    resetBtn.title = 'Reset (Ctrl + 0)';
    resetBtn.addEventListener('click', resetView);
    
    // Zoom level
    const zoomLevel = document.createElement('div');
    zoomLevel.className = 'zoom-level';
    zoomLevel.id = 'zoomLevel';
    zoomLevel.textContent = '100%';
    
    zoomControls.appendChild(panBtn);
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(resetBtn);
    zoomControls.appendChild(zoomLevel);
    
    return zoomControls;
}

// Drag mode
function togglePanMode() {
    isPanMode = !isPanMode;
    const panBtn = document.querySelector('.zoom-btn.pan');
    if (panBtn) {
        if (isPanMode) {
            panBtn.classList.add('active');
            panBtn.title = 'Drag mode on (spacebar) - Click to turn off';
            mermaidContainer.style.cursor = 'grab';
        } else {
            panBtn.classList.remove('active');
            panBtn.title = 'Drag mode off (spacebar) - Click to turn on';
            mermaidContainer.style.cursor = 'default';
        }
    }
}

// Initialize dragging 
function initDragEvents() {
    const svgElement = mermaidDiagram.querySelector('svg');
    if (!svgElement) return;

    // Mouse press
    mermaidContainer.addEventListener('mousedown', (e) => {
        if (isPanMode || e.which === 2 || e.which === 1) {
            e.preventDefault();
            isDragging = true;
            mermaidContainer.classList.add('dragging');
            dragStartX = e.clientX - translateX;
            dragStartY = e.clientY - translateY;
        }
    });

    mermaidContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        translateX = e.clientX - dragStartX;
        translateY = e.clientY - dragStartY;
        
        applyTransform();
    });

    mermaidContainer.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            mermaidContainer.classList.remove('dragging');
        }
    });

    mermaidContainer.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            mermaidContainer.classList.remove('dragging');
        }
    });

    mermaidContainer.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });
}

function applyTransform() {
    const svgElement = mermaidDiagram.querySelector('svg');
    if (!svgElement) return;
    
    svgElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
    svgElement.style.transformOrigin = 'center center';
    
    updateZoomLevel();
}

// Zoom chart
function zoomChart(delta) {
    const svgElement = mermaidDiagram.querySelector('svg');
    if (!svgElement) return;
    
    let newScale = currentScale + delta;
    
    if (newScale < MIN_SCALE) newScale = MIN_SCALE;
    if (newScale > MAX_SCALE) newScale = MAX_SCALE;
    
    currentScale = newScale;
    applyTransform();
}

// Reset view (zoom and pan)
function resetView() {
    const svgElement = mermaidDiagram.querySelector('svg');
    if (!svgElement) return;
    
    currentScale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
}

// Update zoom level display
function updateZoomLevel() {
    const zoomLevelElement = document.getElementById('zoomLevel');
    if (zoomLevelElement) {
        zoomLevelElement.textContent = `${Math.round(currentScale * 100)}%`;
    }
}

// Handling keyboard shortcuts
function handleKeyboardShortcuts(e) {
    
    if (!mermaidContainer.style.display || mermaidContainer.style.display === 'none') {
        return;
    }
    
    /** if (e.key === ' ') {
        e.preventDefault();
        togglePanMode();
    } **/
    
    else if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        zoomChart(SCALE_STEP);
    }
    
    else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomChart(-SCALE_STEP);
    }
    
    else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        resetView();
    }
}

// Render Mermaid diagram with enhanced styling
function renderMermaid(code) {
    // Beautify First
    const beautifulCode = customFormat(code);
    rawMermaidData = beautifulCode;
    
    mermaidLoading.style.display = 'none';
    
    // Set code in hidden block and highlight
    mermaidCodeBlock.textContent = beautifulCode;
    Prism.highlightElement(mermaidCodeBlock);
    
    // Determine visibility based on current mode
    if (!isMermaidCodeView) {
        mermaidContainer.style.display = 'flex';
    } else {
        mermaidCodeContainer.style.display = 'block';
    }
    
    mermaidStatus.className = 'status-dot active';
    mermaidStatus.nextElementSibling.textContent = 'Generated';
    
    mermaidDiagram.innerHTML = '';
    
    const oldZoomControls = mermaidDiagram.querySelector('.zoom-controls');
    if (oldZoomControls) {
        oldZoomControls.remove();
    }
    
    try {
        
        mermaidDiagram.innerHTML = `<div class="mermaid">${code}</div>`;
        
        mermaid.init(undefined, mermaidDiagram.querySelector('.mermaid'));
        
        setTimeout(() => {
            const svgElement = mermaidDiagram.querySelector('svg');
            if (svgElement) {
                
                const zoomControls = createZoomControls();
                mermaidDiagram.appendChild(zoomControls);
                
                resetView();
                
                initDragEvents();
                
                mermaidContainer.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -SCALE_STEP/2 : SCALE_STEP/2;
                        zoomChart(delta);
                    }
                });
            }
        }, 100);
    } catch (err) {
        console.error('Mermaid rendering error:', err);
        mermaidDiagram.innerHTML = `
            <div style="color: #ef4444; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>Flowchart rendering failed</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

// Handle API response
function handleApiResponse(data) {
    hideError();
    
    // Stop timer and set final value
    stopTimer();
    const finalDuration = ((Date.now() - apiStartTime) / 1000).toFixed(1) + 's';
    nextflowTimer.textContent = finalDuration;
    mermaidTimer.textContent = finalDuration;
    
    if (data.status === 'success') {
        setStatus('active', 'Generation successful');
        
        // Show Nextflow code
        if (data.nextflow_code) {
            showNextflowCode(data.nextflow_code);
        } else {
            showNextflowCode('// Nextflow code not generated');
        }
        
        // Show Mermaid diagram
        if (data.mermaid_code) {
            renderMermaid(data.mermaid_code);
        } else {
            renderMermaid(`graph TD
A[No Mermaid code generated] --> B[Please check API response]
style A fill:#ffffff,stroke:#ef4444,stroke-width:3px
style B fill:#ffffff,stroke:#01679c,stroke-width:2px`);
        }
    } else {
        setStatus('error', 'API returned error');
        showError(`API returned status: ${data.status || 'Unknown error'}`);
        
        // Show error placeholder
        showNextflowCode(`// API returned error status: ${JSON.stringify(data, null, 2)}`);
        renderMermaid(`graph TD
A[API returned error] --> B[Status: ${data.status || 'Unknown'}]
style A fill:#ffffff,stroke:#ef4444,stroke-width:3px
style B fill:#ffffff,stroke:#ef4444,stroke-width:2px`);
    }
}

// Call API - using GraphQL format
async function callApi(userText) {
    try {
        setStatus('active', 'Calling API...');
        showLoading(); // This starts the timer
        
        // Build GraphQL query
        const graphqlQuery = {
            query: userText,
        };

        console.log('Sending GraphQL request:', JSON.stringify(graphqlQuery, null, 2));
        
        let response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(graphqlQuery)
        });
        
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        // Check GraphQL response structure
        if (data.errors) {
            throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
        }
        
        // Extract data - adjust according to GraphQL response structure
        let resultData;
        if (data.data && data.data.generate) {
            resultData = data.data.generate;
        } else if (data.status) {
            // Directly returned the required data structure
            resultData = data;
        } else {
            throw new Error('Unable to parse API response structure');
        }
        
        handleApiResponse(resultData);
        
    } catch (error) {
        console.error('API call error:', error);
        setStatus('error', 'API call failed');
        showError(`API call failed: ${error.message}`);
        
        // Show mock data for demonstration
        setTimeout(() => {
            const mockData = {
                status: 'success',
                nextflow_code: `nextflow.enable.dsl=2
// --- IMPORTS ---
include { step_2AS_mapping__ivar } from '../steps/step_2AS_mapping__ivar'
include { step_4TY_lineage__pangolin } from '../steps/step_4TY_lineage__pangolin'
include { extractKey } from '../functions/common.nf'
include { getSingleInput } from '../functions/parameters.nf'

// --- GLOBALS ---
def referenceCode = "NC_045512.2"
def referencePath = "{params.assets_dir}/module_covid_emergency/NC_045512.fasta"
def referenceRiscd = "220308-020220308005121273-2AS_import-external"

// --- MAIN WORKFLOW MODULE ---
workflow module_covid_emergency {
    take: 
        trimmed
    main:
        trimmed.multiMap {
            trimmed: it
            reference: [ referenceRiscd, referenceCode, file(referencePath) ]
        } .set { trAndRef }

        ivar_out = step_2AS_mapping__ivar(trAndRef.trimmed, trAndRef.reference)
        step_4TY_lineage__pangolin(ivar_out.consensus)
}

// --- ENTRYPOINT WORKFLOW ---
workflow {
    module_covid_emergency(getSingleInput())
}`,
                mermaid_code: `flowchart TD
classDef process fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
classDef subworkflow fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px,stroke-dasharray: 5 5;
classDef operator fill:#fff9c4,stroke:#fbc02d,stroke-width:2px,stroke-dasharray: 5 5;
classDef data fill:#e0e0e0,stroke:#333,stroke-width:2px;
classDef global fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px;
Var_trimmed(["trimmed"]):::data
subgraph main_scope ["Main Workflow"]
direction TB
op_trimmed_0{{"multiMap"}}:::operator
Var_trimmed --> op_trimmed_0
Glob_referenceRiscd -.-> op_trimmed_0
Glob_referenceCode -.-> op_trimmed_0
Glob_referencePath -.-> op_trimmed_0
Var_trAndRef_op_trimmed_0(("trAndRef")):::data
op_trimmed_0 --> Var_trAndRef_op_trimmed_0
proc_step_2AS_mapping__ivar["step_2AS_mapping__ivar"]:::process
Var_trAndRef_op_trimmed_0 -- ".trimmed" --> proc_step_2AS_mapping__ivar
Var_trAndRef_op_trimmed_0 -- ".reference" --> proc_step_2AS_mapping__ivar
Var_ivar_out_proc_step_2AS_mapping__ivar(("ivar_out")):::data
proc_step_2AS_mapping__ivar --> Var_ivar_out_proc_step_2AS_mapping__ivar
node_cae3db["step_4TY_lineage__pangolin"]:::process
Var_ivar_out_proc_step_2AS_mapping__ivar -- ".consensus" --> node_cae3db
end
subgraph entrypoint_scope ["Entrypoint"]
proc_module_covid_emergency["module_covid_emergency"]:::process
end`
            };
            handleApiResponse(mockData);
        }, 1500);
    }
}

// Generate button click event
generateBtn.addEventListener('click', () => {
    const text = userInput.value.trim();
    
    if (!text) {
        showError('Please enter a workflow description');
        return;
    }
    
    hideError();
    callApi(text);
});

// Event Listeners for New Controls
copyNextflowBtn.addEventListener('click', () => {
    copyToClipboard(rawNextflowData, copyNextflowBtn);
});

copyMermaidBtn.addEventListener('click', () => {
    copyToClipboard(rawMermaidData, copyMermaidBtn);
});

toggleMermaidBtn.addEventListener('click', () => {
    if (!rawMermaidData) return;
    isMermaidCodeView = !isMermaidCodeView;
    updateMermaidView();
});

// Example button click event
exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const exampleText = btn.getAttribute('data-example');
        userInput.value = exampleText;
        userInput.focus();
        
        // Auto-resize textarea
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });
});

// Input box Enter key (Ctrl+Enter) to send
userInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateBtn.click();
    }
    
    // Auto-resize textarea
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateBtn.click();
    }
});

// Auto-resize textarea on input
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

document.addEventListener('keydown', handleKeyboardShortcuts);

// Initialize page
resetResults();
setStatus('', 'Ready');

// Display some initial content when page loads
window.addEventListener('load', () => {
    console.log('IZS AI workflow generator loaded');
});