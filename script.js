// Navigation and UI State Management
class CarPortal {
    constructor() {
        this.init();
        this.loadSampleData();
        this.setupEventListeners();
    }

    init() {
        this.currentSection = 'dashboard';
        this.vehicles = [];
        this.verificationResults = [];
        this.activityLog = [];
        
        // Mock API base URL (replace with actual API)
        this.apiBaseUrl = 'http://localhost:8080/api';
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // Document verification form
        const verifyForm = document.getElementById('verifyForm');
        if (verifyForm) {
            verifyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.verifyDocument();
            });
        }

        // File upload handling
        const fileUpload = document.getElementById('fileUpload');
        const fileInput = document.getElementById('documentFile');
        
        if (fileUpload && fileInput) {
            fileUpload.addEventListener('click', () => fileInput.click());
            fileUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUpload.style.background = 'rgba(102, 126, 234, 0.15)';
            });
            fileUpload.addEventListener('dragleave', () => {
                fileUpload.style.background = 'rgba(102, 126, 234, 0.05)';
            });
            fileUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        // Vehicle search
        const vehicleSearch = document.getElementById('vehicleSearch');
        if (vehicleSearch) {
            vehicleSearch.addEventListener('input', (e) => {
                this.searchVehicles(e.target.value);
            });
        }

        // Add vehicle button
        const addVehicleBtn = document.getElementById('addVehicle');
        if (addVehicleBtn) {
            addVehicleBtn.addEventListener('click', () => {
                this.showModal('addVehicleModal');
            });
        }

        // Add vehicle form
        const addVehicleForm = document.getElementById('addVehicleForm');
        if (addVehicleForm) {
            addVehicleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addNewVehicle();
            });
        }

        // API tester
        const apiTestForm = document.getElementById('apiTestForm');
        if (apiTestForm) {
            apiTestForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.testApi();
            });
        }

        // VIN scan button
        const scanVinBtn = document.getElementById('scanVin');
        if (scanVinBtn) {
            scanVinBtn.addEventListener('click', () => {
                this.scanVin();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close, [data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.dataset.modal || e.target.closest('.modal').id;
                this.hideModal(modalId);
            });
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });
    }

    switchSection(sectionId) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');

        this.currentSection = sectionId;

        // Load section-specific data
        if (sectionId === 'vehicles') {
            this.loadVehicleTable();
        }
    }

    // Document Verification
    async verifyDocument() {
        const vin = document.getElementById('vinNumber').value;
        const docType = document.getElementById('documentType').value;
        const fileInput = document.getElementById('documentFile');

        if (!vin || !docType || !fileInput.files[0]) {
            this.showAlert('Please fill all fields and upload a document', 'error');
            return;
        }

        this.showLoading('Verifying document...');

        try {
            // Simulate API call
            await this.delay(2000);
            
            const result = await this.mockVerifyDocument(vin, docType, fileInput.files[0]);
            this.displayVerificationResult(result);
            this.addActivity(`Document verified for VIN: ${vin}`, 'success');
            this.updateStats('verifiedDocs', 1);
            
        } catch (error) {
            this.showAlert('Document verification failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async mockVerifyDocument(vin, docType, file) {
        // Mock verification logic
        const isValid = Math.random() > 0.2; // 80% success rate
        
        return {
            vin: vin,
            documentType: docType,
            fileName: file.name,
            fileSize: this.formatFileSize(file.size),
            isValid: isValid,
            status: isValid ? 'VERIFIED' : 'REJECTED',
            details: isValid ? 
                'Document successfully verified against manufacturer records' :
                'Document could not be verified - possible forgery detected',
            verificationDate: new Date().toISOString(),
            confidence: isValid ? (85 + Math.random() * 15).toFixed(1) : (20 + Math.random() * 30).toFixed(1)
        };
    }

    displayVerificationResult(result) {
        const resultsDiv = document.getElementById('verificationResults');
        const statusClass = result.isValid ? 'success' : 'error';
        const statusIcon = result.isValid ? 'check-circle' : 'times-circle';
        
        resultsDiv.innerHTML = `
            <h3>Verification Results</h3>
            <div class="verification-result ${statusClass}">
                <div class="result-header">
                    <i class="fas fa-${statusIcon}"></i>
                    <h4>${result.status}</h4>
                    <span class="confidence">Confidence: ${result.confidence}%</span>
                </div>
                <div class="result-details">
                    <p><strong>VIN:</strong> ${result.vin}</p>
                    <p><strong>Document Type:</strong> ${result.documentType}</p>
                    <p><strong>File:</strong> ${result.fileName} (${result.fileSize})</p>
                    <p><strong>Details:</strong> ${result.details}</p>
                    <p><strong>Verified On:</strong> ${new Date(result.verificationDate).toLocaleString()}</p>
                </div>
            </div>
        `;
    }

    // Vehicle Management
    loadVehicleTable() {
        const tbody = document.getElementById('vehicleTableBody');
        tbody.innerHTML = '';

        this.vehicles.forEach((vehicle, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vehicle.vin}</td>
                <td>${vehicle.make}</td>
                <td>${vehicle.model}</td>
                <td>${vehicle.year}</td>
                <td><span class="status-badge status-${vehicle.status}">${vehicle.status.toUpperCase()}</span></td>
                <td><span class="status-badge status-${vehicle.warranty}">${vehicle.warranty.toUpperCase()}</span></td>
                <td>
                    <button class="btn-secondary" onclick="carPortal.viewVehicle(${index})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-secondary" onclick="carPortal.editVehicle(${index})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    searchVehicles(query) {
        const tbody = document.getElementById('vehicleTableBody');
        const filteredVehicles = this.vehicles.filter(vehicle =>
            vehicle.vin.toLowerCase().includes(query.toLowerCase()) ||
            vehicle.make.toLowerCase().includes(query.toLowerCase()) ||
            vehicle.model.toLowerCase().includes(query.toLowerCase()) ||
            vehicle.year.toString().includes(query)
        );

        tbody.innerHTML = '';
        filteredVehicles.forEach((vehicle, index) => {
            const originalIndex = this.vehicles.indexOf(vehicle);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vehicle.vin}</td>
                <td>${vehicle.make}</td>
                <td>${vehicle.model}</td>
                <td>${vehicle.year}</td>
                <td><span class="status-badge status-${vehicle.status}">${vehicle.status.toUpperCase()}</span></td>
                <td><span class="status-badge status-${vehicle.warranty}">${vehicle.warranty.toUpperCase()}</span></td>
                <td>
                    <button class="btn-secondary" onclick="carPortal.viewVehicle(${originalIndex})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-secondary" onclick="carPortal.editVehicle(${originalIndex})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    addNewVehicle() {
        const vin = document.getElementById('newVin').value;
        const make = document.getElementById('newMake').value;
        const model = document.getElementById('newModel').value;
        const year = parseInt(document.getElementById('newYear').value);
        const warranty = document.getElementById('warrantyStatus').value;

        // Validate VIN
        if (vin.length !== 17) {
            this.showAlert('VIN must be exactly 17 characters', 'error');
            return;
        }

        // Check for duplicate VIN
        if (this.vehicles.some(v => v.vin === vin)) {
            this.showAlert('Vehicle with this VIN already exists', 'error');
            return;
        }

        const newVehicle = {
            vin: vin,
            make: make,
            model: model,
            year: year,
            status: 'active',
            warranty: warranty,
            addedDate: new Date().toISOString()
        };

        this.vehicles.push(newVehicle);
        this.hideModal('addVehicleModal');
        this.loadVehicleTable();
        this.addActivity(`New vehicle added: ${make} ${model} ${year}`, 'info');
        this.updateStats('vehiclesRegistered', 1);
        this.showAlert('Vehicle added successfully!', 'success');

        // Clear form
        document.getElementById('addVehicleForm').reset();
    }

    viewVehicle(index) {
        const vehicle = this.vehicles[index];
        alert(`Vehicle Details:\n\nVIN: ${vehicle.vin}\nMake: ${vehicle.make}\nModel: ${vehicle.model}\nYear: ${vehicle.year}\nStatus: ${vehicle.status}\nWarranty: ${vehicle.warranty}`);
    }

    editVehicle(index) {
        // Simple edit functionality
        const vehicle = this.vehicles[index];
        const newStatus = prompt(`Edit status for ${vehicle.make} ${vehicle.model} (active/inactive/pending):`, vehicle.status);
        
        if (newStatus && ['active', 'inactive', 'pending'].includes(newStatus)) {
            this.vehicles[index].status = newStatus;
            this.loadVehicleTable();
            this.addActivity(`Vehicle status updated: ${vehicle.vin}`, 'info');
            this.showAlert('Vehicle updated successfully!', 'success');
        }
    }

    // API Testing
    async testApi() {
        const endpoint = document.getElementById('apiEndpoint').value;
        const vin = document.getElementById('apiVin').value;

        if (!vin && endpoint !== '/api/recall/check') {
            this.showAlert('Please enter a VIN for testing', 'error');
            return;
        }

        const responseContent = document.getElementById('responseContent');
        responseContent.textContent = 'Loading...';

        try {
            await this.delay(1000);
            const mockResponse = await this.mockApiCall(endpoint, vin);
            responseContent.textContent = JSON.stringify(mockResponse, null, 2);
            this.updateStats('apiRequests', 1);
        } catch (error) {
            responseContent.textContent = `Error: ${error.message}`;
        }
    }

    async mockApiCall(endpoint, vin) {
        switch (endpoint) {
            case '/api/vehicle/':
                return {
                    success: true,
                    data: {
                        vin: vin,
                        make: 'Toyota',
                        model: 'Camry',
                        year: 2024,
                        status: 'active',
                        warranty: {
                            status: 'active',
                            expiryDate: '2027-08-15'
                        },
                        recalls: []
                    }
                };
            
            case '/api/warranty/':
                return {
                    success: true,
                    data: {
                        vin: vin,
                        warranty: {
                            status: 'active',
                            type: 'comprehensive',
                            startDate: '2024-01-15',
                            endDate: '2027-01-15',
                            coverage: ['engine', 'transmission', 'electrical']
                        }
                    }
                };
            
            case '/api/recall/check':
                return {
                    success: true,
                    data: {
                        recalls: [
                            {
                                id: 'RC-2024-001',
                                title: 'Airbag Sensor Issue',
                                severity: 'medium',
                                affected_vins: ['ABC123456789*'],
                                description: 'Potential airbag sensor malfunction',
                                remedy: 'Sensor replacement at authorized dealer'
                            }
                        ]
                    }
                };
            
            default:
                throw new Error('Unknown endpoint');
        }
    }

    // File Handling
    handleFileUpload(file) {
        const fileUpload = document.getElementById('fileUpload');
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showAlert('File size must be less than 10MB', 'error');
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            this.showAlert('Only PDF, JPG, and PNG files are allowed', 'error');
            return;
        }

        fileUpload.innerHTML = `
            <i class="fas fa-file-check" style="color: #28a745;"></i>
            <p style="color: #28a745;">File selected: ${file.name}</p>
            <small>${this.formatFileSize(file.size)}</small>
        `;
    }

    // VIN Scanning (Mock)
    scanVin() {
        this.showAlert('VIN scanner would be implemented with camera API', 'info');
        // Mock scan result
        setTimeout(() => {
            document.getElementById('vinNumber').value = 'ABC123456789DEFGH';
        }, 1000);
    }

    // Utility Functions
    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showAlert(message, type) {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${message}
        `;

        // Add to current section
        const currentSectionEl = document.querySelector('.section.active');
        currentSectionEl.insertBefore(alert, currentSectionEl.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }

    showLoading(message) {
        const verificationResults = document.getElementById('verificationResults');
        verificationResults.innerHTML = `
            <h3>Verification Results</h3>
            <div class="loading-container" style="text-align: center; padding: 40px;">
                <div class="loading"></div>
                <p style="margin-top: 15px;">${message}</p>
            </div>
        `;
    }

    hideLoading() {
        // Loading will be replaced by results
    }

    addActivity(message, type) {
        const activity = {
            message: message,
            type: type,
            timestamp: new Date()
        };

        this.activityLog.unshift(activity);
        this.updateActivityDisplay();
    }

    updateActivityDisplay() {
        const activityList = document.getElementById('activityList');
        const recent = this.activityLog.slice(0, 5); // Show last 5 activities

        activityList.innerHTML = recent.map(activity => `
            <div class="activity-item">
                <i class="fas fa-${this.getActivityIcon(activity.type)} text-${activity.type}"></i>
                <span>${activity.message}</span>
                <span class="time">${this.formatTimeAgo(activity.timestamp)}</span>
            </div>
        `).join('');
    }

    getActivityIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'info': return 'info-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'circle';
        }
    }

    updateStats(statId, increment = 1) {
        const element = document.getElementById(statId);
        if (element) {
            const current = parseInt(element.textContent.replace(/,/g, ''));
            const newValue = current + increment;
            element.textContent = newValue.toLocaleString();
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Load sample data
    loadSampleData() {
        this.vehicles = [
            { vin: 'ABC123456789DEFGH', make: 'Toyota', model: 'Camry', year: 2024, status: 'active', warranty: 'active' },
            { vin: 'DEF987654321HGFED', make: 'Honda', model: 'Civic', year: 2023, status: 'active', warranty: 'active' },
            { vin: 'GHI456789123ABCDE', make: 'Ford', model: 'Focus', year: 2022, status: 'inactive', warranty: 'expired' },
            { vin: 'JKL789123456FGHIJ', make: 'Nissan', model: 'Altima', year: 2024, status: 'active', warranty: 'pending' },
            { vin: 'MNO321654987KLMNO', make: 'Hyundai', model: 'Elantra', year: 2023, status: 'active', warranty: 'active' }
        ];

        // Initialize activity log
        this.addActivity('System initialized successfully', 'success');
        this.addActivity('Vehicle database loaded', 'info');
    }
}

// Initialize the portal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.carPortal = new CarPortal();
});

// Additional CSS for verification results
const additionalStyles = `
    .verification-result {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin-top: 15px;
    }
    
    .verification-result.success {
        border-left: 4px solid #28a745;
    }
    
    .verification-result.error {
        border-left: 4px solid #dc3545;
    }
    
    .result-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .result-header i {
        font-size: 1.5rem;
    }
    
    .result-header h4 {
        margin: 0;
        flex: 1;
    }
    
    .confidence {
        background: #f8f9fa;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.9rem;
        font-weight: bold;
    }
    
    .result-details p {
        margin: 8px 0;
        font-size: 0.95rem;
    }
    
    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
