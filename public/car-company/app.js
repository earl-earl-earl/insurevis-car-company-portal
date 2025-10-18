// Car Company Portal - Document Verification System
// Supabase Configuration
const supabaseUrl = 'https://vvnsludqdidnqpbzzgeb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bnNsdWRxZGlkbnFwYnp6Z2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg3MjIsImV4cCI6MjA3MDcyNDcyMn0.aFtPK2qhVJw3z324PjuM-q7e5_4J55mgm7A2fqkLO3c';

const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Global variables
let currentClaim = null;
let currentDocuments = [];
let currentVehicleInfo = null;
let currentClaimApproved = false;

// Car company verifiable document types
const CAR_COMPANY_DOCUMENT_TYPES = [
    'lto_or',
    'lto_cr', 
    'drivers_license',
    'owner_valid_id',
    'stencil_strips',
    'damage_photos',
    'job_estimate'
];

// Document type display names
const DOCUMENT_TYPE_NAMES = {
    'lto_or': 'LTO Official Receipt',
    'lto_cr': 'LTO Certificate of Registration',
    'drivers_license': "Driver's License",
    'owner_valid_id': 'Owner Valid ID',
    'stencil_strips': 'Stencil Strips',
    'damage_photos': 'Damage Photos',
    'job_estimate': 'Job Estimate',
    'police_report': 'Police Report',
    'insurance_policy': 'Insurance Policy',
    'additional_documents': 'Additional Documents'
};

const ROLE_ROUTES = {
    car_company: '/car-company/',
    'car-company': '/car-company/',
    insurance_company: '/insurance-company/',
    'insurance-company': '/insurance-company/'
};

function normalizeRole(role) {
    if (!role) return null;
    const value = String(role).toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (value.includes('car') && value.includes('company')) return 'car_company';
    if (value.includes('insurance') && value.includes('company')) return 'insurance_company';
    return ROLE_ROUTES[value] ? value : null;
}

function extractRoleFromMetadata(user) {
    if (!user) return null;
    const { app_metadata: appMeta = {}, user_metadata: userMeta = {} } = user;
    const candidates = [];
    if (appMeta.role) candidates.push(appMeta.role);
    if (Array.isArray(appMeta.roles) && appMeta.roles.length > 0) candidates.push(appMeta.roles[0]);
    if (userMeta.role) candidates.push(userMeta.role);
    if (Array.isArray(userMeta.roles) && userMeta.roles.length > 0) candidates.push(userMeta.roles[0]);
    for (const candidate of candidates) {
        const normalized = normalizeRole(candidate);
        if (normalized) return normalized;
    }
    return null;
}

async function resolveUserRole(user) {
    const metaRole = extractRoleFromMetadata(user);
    if (metaRole) return metaRole;

    const fallbackSources = [
        { table: 'profiles', column: 'role' },
        { table: 'portal_profiles', column: 'role' }
    ];

    for (const source of fallbackSources) {
        try {
            const { data, error } = await supabase
                .from(source.table)
                .select(source.column)
                .eq('id', user.id)
                .maybeSingle();

            if (!error && data && data[source.column]) {
                const normalized = normalizeRole(data[source.column]);
                if (normalized) return normalized;
            }
        } catch (err) {
            console.debug(`Role lookup for ${source.table} skipped:`, err.message || err);
        }
    }

    return null;
}

function redirectTo(path) {
    if (!path) return;
    window.location.replace(path);
}

async function bootstrapPortal() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
            redirectTo('/');
            return;
        }

        const role = await resolveUserRole(user);
        if (role !== 'car_company') {
            const destination = ROLE_ROUTES[role] || '/';
            redirectTo(destination);
            return;
        }

        initializeApp();
    } catch (error) {
        console.error('Failed to initialise car company portal:', error);
        redirectTo('/');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', bootstrapPortal);

async function initializeApp() {
    console.log('Initializing Car Company Portal...');
    
    // Ensure action buttons are hidden on init
    const decisionActions = document.getElementById('carClaimDecisionActions');
    if (decisionActions) {
        decisionActions.style.display = 'none';
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Check if we have any claims data, if not create test data
    const { data: existingClaims } = await supabase
        .from('claims')
        .select('id')
        .limit(1);
    
    if (!existingClaims || existingClaims.length === 0) {
        console.log('No claims found, creating test data...');
        await createTestData();
    }
    
    // Load claims data
    await loadClaims();
}

async function createTestData() {
    try {
        // Create test users
        const testUsers = [
            {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'John Doe',
                email: 'john.doe@example.com',
                phone: '+1-555-0123',
                created_at: new Date().toISOString()
            },
            {
                id: '22222222-2222-2222-2222-222222222222',
                name: 'Jane Smith',
                email: 'jane.smith@example.com',
                phone: '+1-555-0456',
                created_at: new Date().toISOString()
            }
        ];

        // Insert users (ignore conflicts)
        await supabase
            .from('users')
            .upsert(testUsers, { onConflict: 'id' });

        // Create test claims
        const testClaims = [
            {
                id: 'claim-001',
                claim_number: 'CLM-2025-001',
                user_id: '11111111-1111-1111-1111-111111111111',
                status: 'submitted',
                is_approved_by_car_company: false,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'claim-002',
                claim_number: 'CLM-2025-002',
                user_id: '22222222-2222-2222-2222-222222222222',
                status: 'under_review',
                is_approved_by_car_company: false,
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        await supabase
            .from('claims')
            .upsert(testClaims, { onConflict: 'id' });

        // Create test documents
        const testDocuments = [
            // Claim 1 documents
            {
                id: 'doc-001',
                claim_id: 'claim-001',
                type: 'lto_or',
                file_name: 'lto_official_receipt_1757234240831_0_licensed-image.jpeg',
                file_size_bytes: 245760,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-001/doc-001/lto_official_receipt_1757234240831_0_licensed-image.jpeg',
                verified_by_car_company: false,
                is_primary: true,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'doc-002',
                claim_id: 'claim-001',
                type: 'lto_cr',
                file_name: 'lto_certificate_1757234240832_1_licensed-image.jpeg',
                file_size_bytes: 189440,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-001/doc-002/lto_certificate_1757234240832_1_licensed-image.jpeg',
                verified_by_car_company: true,
                car_company_verification_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                car_company_verification_notes: 'Document verified successfully against manufacturer records',
                is_primary: false,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'doc-003',
                claim_id: 'claim-001',
                type: 'damage_photos',
                file_name: 'damage_photo_1757234240833_2_licensed-image.jpeg',
                file_size_bytes: 312800,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-001/doc-003/damage_photo_1757234240833_2_licensed-image.jpeg',
                verified_by_car_company: false,
                is_primary: false,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'doc-004',
                claim_id: 'claim-001',
                type: 'job_estimate',
                file_name: 'repair_estimate_1757234240834_3_licensed-image.jpeg',
                file_size_bytes: 287340,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-001/doc-004/repair_estimate_1757234240834_3_licensed-image.jpeg',
                verified_by_car_company: false,
                is_primary: false,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            // Claim 2 documents
            {
                id: 'doc-005',
                claim_id: 'claim-002',
                type: 'drivers_license',
                file_name: 'drivers_license_1757234240835_0_licensed-image.jpeg',
                file_size_bytes: 198600,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-002/doc-005/drivers_license_1757234240835_0_licensed-image.jpeg',
                verified_by_car_company: false,
                is_primary: true,
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'doc-006',
                claim_id: 'claim-002',
                type: 'owner_valid_id',
                file_name: 'owner_id_1757234240836_1_licensed-image.jpeg',
                file_size_bytes: 234560,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-002/doc-006/owner_id_1757234240836_1_licensed-image.jpeg',
                verified_by_car_company: true,
                car_company_verification_date: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
                car_company_verification_notes: 'ID verified - matches vehicle registration records',
                is_primary: false,
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'doc-007',
                claim_id: 'claim-002',
                type: 'stencil_strips',
                file_name: 'vehicle_stencils_1757234240837_2_licensed-image.jpeg',
                file_size_bytes: 267890,
                format: 'jpeg',
                status: 'uploaded',
                remote_url: 'https://vvnsludqdidnqpbzzgeb.supabase.co/storage/v1/object/public/insurevis-documents/claim-002/doc-007/vehicle_stencils_1757234240837_2_licensed-image.jpeg',
                verified_by_car_company: false,
                is_primary: false,
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        await supabase
            .from('documents')
            .upsert(testDocuments, { onConflict: 'id' });

        console.log('✅ Test data created successfully');
        
    } catch (error) {
        console.error('Error creating test data:', error);
        // Continue anyway - the app should still work without test data
    }
}

function setupEventListeners() {
    // Search functionality
    document.getElementById('claimsSearch').addEventListener('input', filterClaims);
    document.getElementById('statusFilter').addEventListener('change', filterClaims);
    
    // Navigation
    document.getElementById('backToClaims').addEventListener('click', showClaimsPage);

    // Logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                // Set flag to prevent login page from auto-redirecting
                sessionStorage.setItem('justLoggedOut', 'true');
                await supabase.auth.signOut();
            } catch (error) {
                console.error('Failed to sign out:', error);
            } finally {
                window.location.replace('/');
            }
        });
    }
    
    // Document verification
    document.getElementById('saveVerification').addEventListener('click', saveDocumentVerification);

    // Claim decision buttons (approve/reject)
    setupClaimDecisionButtons();

    // Claim status dropdown/control removed from UI; status updates are handled elsewhere.
}

// Claims Management
async function loadClaims() {
    const loadingElement = document.getElementById('loadingClaims');
    const tableBody = document.getElementById('claimsTableBody');
    
    loadingElement.style.display = 'block';
    
    try {
        // Fetch claims with user information and document counts
            const { data: claims, error } = await supabase
                .from('claims')
                .select(`
                    *,
                    users:user_id (
                        name,
                        email,
                        phone
                    ),
                    documents (
                        id,
                        type,
                        verified_by_car_company
                    )
                `)
                .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching claims:', error);
            showError('Failed to load claims');
            return;
        }

        console.log('Loaded claims:', claims);
        
        // Process claims data
        const processedClaims = claims.map(claim => {
            const carCompanyDocs = claim.documents.filter(doc => 
                CAR_COMPANY_DOCUMENT_TYPES.includes(doc.type)
            );
            const verifiedCarDocs = carCompanyDocs.filter(doc => 
                doc.verified_by_car_company
            );
            
            return {
                ...claim,
                totalCarCompanyDocs: carCompanyDocs.length,
                verifiedCarCompanyDocs: verifiedCarDocs.length,
                pendingCarCompanyDocs: carCompanyDocs.length - verifiedCarDocs.length
            };
        });

        displayClaims(processedClaims);
        
    } catch (error) {
        console.error('Error loading claims:', error);
        showError('Failed to load claims');
    } finally {
        loadingElement.style.display = 'none';
    }
}

function displayClaims(claims) {
    const tableBody = document.getElementById('claimsTableBody');
    
    if (!claims || claims.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">
                    <i class="fas fa-inbox"></i>
                    <p>No claims found</p>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = claims.map(claim => `
        <tr class="claim-row ${((claim.is_verified_by_car_company ?? claim.isVerifiedByCarCompany ?? claim.is_approved_by_car_company) ? 'approved-row' : '')}" data-claim-id="${claim.id}">
            <td>
                <strong>${claim.claim_number}</strong>
            </td>
            <td>
                <div class="user-info">
                    <span class="user-name">${claim.users?.name || 'Unknown'}</span>
                        <small>${claim.users?.email || ''}${claim.users?.phone ? ' · ' + claim.users.phone : ''}</small>
                </div>
            </td>
            <td>
                ${(() => {
                    const approvedFlag = (
                        claim.is_verified_by_car_company ??
                        claim.isVerifiedByCarCompany ??
                        claim.is_approved_by_car_company ??
                        false
                    );
                    const approved = !!approvedFlag;
                    const label = approved ? 'Approved' : 'In Review';
                    const klass = approved ? 'approved' : 'under_review';
                    return `<span class="status-badge status-${klass}">${label}</span>`;
                })()}
            </td>
            <td>
                <div class="verification-status">
                    ${claim.is_approved_by_car_company ? 
                        '<i class="fas fa-check-circle text-success"></i> Approved' : 
                        '<i class="fas fa-clock text-warning"></i> Pending'
                    }
                </div>
            </td>
            <td>
                <span class="doc-count">${claim.totalCarCompanyDocs}</span>
            </td>
            <td>
                <span class="pending-count ${claim.pendingCarCompanyDocs > 0 ? 'has-pending' : ''}">
                    ${claim.pendingCarCompanyDocs}
                </span>
            </td>
            <td>
                <span class="date">${formatDate(claim.created_at)}</span>
            </td>
            <td>
                <button class="btn-primary btn-sm" onclick="viewClaimDocuments('${claim.id}')">
                    <i class="fas fa-eye"></i> View Documents
                </button>
            </td>
        </tr>
    `).join('');

    // Add click handlers to table rows
    document.querySelectorAll('.claim-row').forEach(row => {
        row.addEventListener('click', function(e) {
            if (!e.target.closest('button')) {
                const claimId = this.dataset.claimId;
                viewClaimDocuments(claimId);
            }
        });
    });
}

async function viewClaimDocuments(claimId) {
    currentClaim = claimId;
    
    // Show documents page
    showDocumentsPage();
    
    // Load documents for this claim
    await loadClaimDocuments(claimId);
}

async function loadClaimDocuments(claimId) {
    const loadingElement = document.getElementById('loadingDocuments');
    const documentsGrid = document.getElementById('documentsGrid');
    
    loadingElement.style.display = 'block';
    
    try {
        // Fetch claim details
        const { data: claim, error: claimError } = await supabase
            .from('claims')
            .select(`
                *,
                users:user_id (name, email, phone)
            `)
            .eq('id', claimId)
            .single();

        if (claimError) {
            console.error('Error fetching claim:', claimError);
            showError('Failed to load claim details');
            return;
        }

    // Remember which claim is open
        currentClaim = claim.id;
    // Track approval state for UI logic
    currentClaimApproved = !!(claim.is_approved_by_car_company || claim.is_verified_by_car_company || claim.isVerifiedByCarCompany);

        // Update claim header
        document.getElementById('claimTitle').textContent = `Claim ${claim.claim_number}`;
        document.getElementById('claimDescription').textContent = 
            `Documents for ${claim.users?.name || 'Unknown User'} - Car Company Verification`;

        // (status pill update moved further down after summaryClaim is set)

        // Populate top-of-grid vehicle summary using fields from the claim
        try {
            // Prefer vehicle fields stored on the claim record. These attribute
            // names were provided: vehicle_make, vehicle_model, vehicle_year,
            // vehicle_plate_number.
            const vehicleMake = claim.vehicle_make || null;
            const vehicleModel = claim.vehicle_model || null;
            const vehicleYear = claim.vehicle_year || null;
            const vehiclePlate = claim.vehicle_plate_number || null;

            currentVehicleInfo = {
                make: vehicleMake || undefined,
                model: vehicleModel || undefined,
                year: vehicleYear || undefined,
                licensePlate: vehiclePlate || undefined
            };

            document.getElementById('summaryClaim').textContent = `Claim ${claim.claim_number}`;
            document.getElementById('summaryUser').textContent = `${claim.users?.name || 'Unknown User'} · ${claim.users?.email || ''}`;
            // Update small status pill next to the claim summary title (after setting summaryClaim)
            try {
                const pill = document.getElementById('statusPill');
                if (pill) {
                    // Map 'under_review' as the review state used throughout the UI
                    if (claim.status === 'under_review') {
                        pill.textContent = 'In Review';
                        pill.className = 'status-pill status-under_review';
                    } else {
                        const normalized = (claim.status || 'draft').toLowerCase();
                        pill.textContent = formatStatus(normalized);
                        pill.className = 'status-pill status-' + normalized.replace(/\s+/g, '_');
                    }
                    pill.style.textTransform = 'none';
                    pill.style.display = '';
                }
            } catch (err) {
                console.warn('Could not update status pill:', err);
            }
            document.getElementById('summaryMake').textContent = currentVehicleInfo.make || '-';
            document.getElementById('summaryModel').textContent = currentVehicleInfo.model || '-';
            document.getElementById('summaryYear').textContent = currentVehicleInfo.year || '-';
            document.getElementById('summaryPlate').textContent = currentVehicleInfo.licensePlate || '-';
        } catch (err) {
            console.warn('Could not populate vehicle summary:', err);
            currentVehicleInfo = null;
        }

        // Fetch documents that car company can verify
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('claim_id', claimId)
            .in('type', CAR_COMPANY_DOCUMENT_TYPES)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

        if (docsError) {
            console.error('Error fetching documents:', docsError);
            showError('Failed to load documents');
            return;
        }

        console.log('Loaded documents:', documents);
        currentDocuments = documents;

        // Update stats
        updateDocumentStats(documents);
        
        // Display documents
        displayDocuments(documents);

        // Update decision buttons enabled/disabled state based on claim status
        try {
            setDecisionButtonsState(claim);
        } catch (e) {
            console.warn('Failed to set decision buttons state', e);
        }

        // Apply approved visual/banner and lock controls if approved
        try {
            applyApprovedState(claim);
        } catch (e) {
            console.warn('Failed to apply approved state UI', e);
        }

        // Show the claim status control for all claims when viewing the claim details.
        // If you later want to restrict this to claim owners or admins, add a
        // permission check here (e.g. compare current user id to claim.user_id).
        // Claim status control removed from the UI per user request.

    } catch (error) {
        console.error('Error loading claim documents:', error);
        showError('Failed to load documents');
    } finally {
        loadingElement.style.display = 'none';
    }
}

function updateDocumentStats(documents) {
    const total = documents.length;
    const verified = documents.filter(doc => doc.verified_by_car_company).length;
    const pending = total - verified;

    document.getElementById('totalDocs').textContent = total;
    document.getElementById('verifiedDocs').textContent = verified;
    document.getElementById('pendingDocs').textContent = pending;

    // Only show claim decision actions when a claim is actively viewed
    // and all car-company-verifiable documents for that claim are verified.
    const decisionActions = document.getElementById('carClaimDecisionActions');
    if (decisionActions) {
        const isClaimOpen = !!currentClaim;
        const allVerified = total > 0 && verified === total;
        if (isClaimOpen && allVerified) {
            decisionActions.style.display = 'flex';
        } else {
            decisionActions.style.display = 'none';
        }
    }
}

// Claim decision handlers
function setupClaimDecisionButtons() {
    const approveBtn = document.getElementById('approveClaimBtn');
    const rejectBtn = document.getElementById('rejectClaimBtn');

    if (approveBtn) approveBtn.addEventListener('click', () => openApprovalConfirm());
    if (rejectBtn) rejectBtn.addEventListener('click', () => decideClaim('rejected'));
}

// Enable or disable decision buttons based on claim status
function setDecisionButtonsState(claim) {
    const approveBtn = document.getElementById('approveClaimBtn');
    const rejectBtn = document.getElementById('rejectClaimBtn');
    if (!approveBtn || !rejectBtn) return;

    // Approve button is enabled only when all car-company documents are verified
    // and the claim is not already approved (claim.is_approved_by_car_company !== true).
    const allDocsVerified = Array.isArray(currentDocuments) && currentDocuments.length > 0 && currentDocuments.every(d => !!d.verified_by_car_company);
    const claimApprovedFlag = !!(claim && claim.is_approved_by_car_company);
    const approveDisabled = !allDocsVerified || claimApprovedFlag;

    approveBtn.disabled = !!approveDisabled;
    if (approveBtn.disabled) approveBtn.classList.add('decision-btn--disabled'); else approveBtn.classList.remove('decision-btn--disabled');

    // Reject is always available to allow explicit rejection notification
    const rejectDisabled = claimApprovedFlag ? true : false;
    rejectBtn.disabled = !!rejectDisabled;
    if (rejectBtn.disabled) rejectBtn.classList.add('decision-btn--disabled'); else rejectBtn.classList.remove('decision-btn--disabled');
}

async function decideClaim(decision) {
    if (!currentClaim) {
        showError('No claim selected');
        return;
    }

    try {
        const updateData = {};
        if (decision === 'approved') {
            // Mark claim as approved by car company
            updateData.is_approved_by_car_company = true;
            updateData.car_company_approval_date = new Date().toISOString();
            // Also set a dedicated flag used earlier if exists
            // (already setting is_approved_by_car_company above)
            // Send notification to claim owner. Resolve user id from claim if possible.
            (async () => {
                try {
                    const { data: claimData, error: claimErr } = await supabase
                        .from('claims')
                        .select('user_id, claim_number')
                        .eq('id', currentClaim)
                        .single();
                    const userId = claimData && claimData.user_id ? claimData.user_id : null;
                    const claimNumber = claimData && claimData.claim_number ? claimData.claim_number : currentClaim;
                    if (userId) {
                        sendNotifToUser(userId, 'Claim Approved', `Your claim ${claimNumber} has been approved by the Car Company.`, 'approved');
                    } else {
                        console.warn('decideClaim: could not determine user_id to notify (approved)');
                    }
                } catch (e) {
                    console.warn('decideClaim: error resolving claim user_id for approved notification', e);
                }
            })();
        } else if (decision === 'rejected') {
            // mark as not approved by car company
            updateData.is_approved_by_car_company = false;
            updateData.car_company_approval_date = null;
            (async () => {
                try {
                    const { data: claimData, error: claimErr } = await supabase
                        .from('claims')
                        .select('user_id, claim_number')
                        .eq('id', currentClaim)
                        .single();
                    const userId = claimData && claimData.user_id ? claimData.user_id : null;
                    const claimNumber = claimData && claimData.claim_number ? claimData.claim_number : currentClaim;
                    if (userId) {
                        sendNotifToUser(userId, 'Claim Rejected', `Your claim ${claimNumber} has been rejected by the Car Company. Please contact support for details.`, 'rejected');
                    } else {
                        console.warn('decideClaim: could not determine user_id to notify (rejected)');
                    }
                } catch (e) {
                    console.warn('decideClaim: error resolving claim user_id for rejected notification', e);
                }
            })();
        } else if (decision === 'under_review') {
            updateData.status = 'under_review';
            (async () => {
                try {
                    const { data: claimData, error: claimErr } = await supabase
                        .from('claims')
                        .select('user_id, claim_number')
                        .eq('id', currentClaim)
                        .single();
                    const userId = claimData && claimData.user_id ? claimData.user_id : null;
                    const claimNumber = claimData && claimData.claim_number ? claimData.claim_number : currentClaim;
                    if (userId) {
                        sendNotifToUser(userId, 'Claim Under Review', `Your claim ${claimNumber} is marked as Under Review by the Car Company. We will get back to you soon.`, 'review');
                    } else {
                        console.warn('decideClaim: could not determine user_id to notify (under_review)');
                    }
                } catch (e) {
                    console.warn('decideClaim: error resolving claim user_id for under_review notification', e);
                }
            })();
            // Do not change verified flag on hold
        }

        const { error } = await supabase
            .from('claims')
            .update(updateData)
            .eq('id', currentClaim);

        if (error) {
            console.error('Error updating claim decision:', error);
            showError('Failed to update claim status');
            return;
        }

    // Update UI: hide decision actions and refresh claims list and document header
    document.getElementById('carClaimDecisionActions').style.display = 'none';
        showSuccess(decision === 'approved' ? 'Claim approved' : decision === 'rejected' ? 'Claim rejected' : 'Claim marked as Under Review');
        // Refresh claims and claim details
    await loadClaims();
    await loadClaimDocuments(currentClaim);
    try { applyApprovedState({ is_approved_by_car_company: updateData.is_approved_by_car_company }); } catch (e) {}

    } catch (err) {
        console.error('Error in decideClaim:', err);
        showError('Failed to perform claim decision');
    }
}


function sendNotifToUser(userId, title, message, status) {
    const uri = 'https://vvnsludqdidnqpbzzgeb.supabase.co/functions/v1/send-notification';
    // Wrap in an async IIFE so callers can optionally await the returned promise
    return (async function() {
        if (!userId) {
            console.warn('sendNotifToUser called without userId');
            return { error: 'missing_userId' };
        }

        const payload = {
            targetUserId: userId,
            title: title || 'Notification',
            body: message || '',
            status: status || null
        };

        try {
            const resp = await fetch(uri, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Use public anon key to authenticate the request to Supabase Edge Function
                    'Authorization': 'Bearer ' + supabaseAnonKey,
                    // NOTE: custom headers can trigger CORS preflight failures if
                    // the server does not explicitly allow them. The `X-Client-Info`
                    // header caused a blocked preflight for localhost dev. Remove
                    // it unless your server's CORS allow-list includes it.
                    // 'X-Client-Info': 'insurevis-web-portal/1.0'
                },
                body: JSON.stringify(payload)
            });

            const text = await resp.text();
            let data = null;
            try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

            if (!resp.ok) {
                console.error('sendNotifToUser failed', resp.status, data);
                return { ok: false, status: resp.status, data };
            }

            console.log('sendNotifToUser succeeded', data);
            return { ok: true, status: resp.status, data };

        } catch (err) {
            console.error('sendNotifToUser error', err);
            return { ok: false, error: err.message || err };
        }
    })();
}

function displayDocuments(documents) {
    const documentsGrid = document.getElementById('documentsGrid');
    
    if (!documents || documents.length === 0) {
        documentsGrid.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>No car company verifiable documents found for this claim</p>
            </div>
        `;
        return;
    }

    documentsGrid.innerHTML = documents.map(doc => `
        <div class="document-card ${doc.verified_by_car_company ? 'verified' : 'pending'}" 
             data-document-id="${doc.id}">
            <div class="document-header">
                <div class="document-type">
                    <i class="fas ${getDocumentIcon(doc.type)}"></i>
                    <span>${DOCUMENT_TYPE_NAMES[doc.type] || doc.type}</span>
                </div>
                <div class="verification-badge">
                    ${doc.verified_by_car_company ? 
                        '<i class="fas fa-check-circle verified"></i>' : 
                        '<i class="fas fa-clock pending"></i>'
                    }
                </div>
            </div>
            
            <div class="document-info">
                <p class="file-name">${doc.file_name}</p>
                <p class="upload-date">Uploaded: ${formatDate(doc.created_at)}</p>
                ${doc.car_company_verification_date ? 
                    `<p class="verified-date">Verified: ${formatDate(doc.car_company_verification_date)}</p>` : 
                    ''
                }
            </div>

            <div class="document-actions">
                <button class="btn-primary" onclick="viewDocument('${doc.id}')">
                    <i class="fas fa-eye"></i> ${currentClaimApproved ? 'View' : 'View & Verify'}
                </button>
            </div>

            ${doc.is_primary ? '<div class="primary-badge">Primary Document</div>' : ''}
        </div>
    `).join('');
}

async function viewDocument(documentId) {
    console.log('🔍 ViewDocument called with ID:', documentId);
    
    const doc = currentDocuments.find(doc => doc.id === documentId);
    if (!doc) {
        console.error('❌ Document not found:', documentId);
        showError('Document not found');
        return;
    }

    console.log('📄 Found document:', doc);

    // Populate modal with document information
    document.getElementById('documentTitle').textContent = DOCUMENT_TYPE_NAMES[doc.type] || doc.type;
    document.getElementById('docType').textContent = DOCUMENT_TYPE_NAMES[doc.type] || doc.type;
    document.getElementById('docFileName').textContent = doc.file_name;
    document.getElementById('docUploadDate').textContent = formatDate(doc.created_at);
    document.getElementById('docStatus').textContent = formatStatus(doc.status);

    // Populate vehicle information (this would normally come from the claim or document data)
    await populateVehicleInformation(currentClaim, doc);

    // Set verification status
    const verifyCheckbox = document.getElementById('verifyCheckbox');
    const verificationNotes = document.getElementById('verificationNotes');
    
    verifyCheckbox.checked = doc.verified_by_car_company;
    verificationNotes.value = doc.car_company_verification_notes || '';

    // Respect approved state: make view-only if claim already approved
    if (currentClaimApproved) {
        verifyCheckbox.disabled = true;
        verificationNotes.disabled = true;
        const saveBtn = document.getElementById('saveVerification');
        if (saveBtn) saveBtn.disabled = true;
    } else {
        verifyCheckbox.disabled = false;
        verificationNotes.disabled = false;
        const saveBtn = document.getElementById('saveVerification');
        if (saveBtn) saveBtn.disabled = false;
    }

    // Load document content
    console.log('🔄 Loading document content...');
    await loadDocumentContent(doc);

    // Store current document ID for saving
    document.getElementById('saveVerification').dataset.documentId = documentId;

    // Show modal
    console.log('✅ Showing modal');
    document.getElementById('documentViewerModal').style.display = 'flex';
}

// Feature flag: prefer fallback blob download over signed URLs
const PREFER_STORAGE_DOWNLOAD = true;

async function loadDocumentContent(doc) {
    const contentDiv = document.getElementById('documentContent');
    console.log('📥 Loading document content for:', doc.file_name);
    
    // Show loading state briefly
    contentDiv.innerHTML = `
        <div class="document-preview loading-preview">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #667eea;"></i>
            <p>Loading document...</p>
        </div>
    `;
    
    try {
    // If we prefer storage download, skip generating signed URLs and go
    // straight to the fallback renderer.
    if (PREFER_STORAGE_DOWNLOAD) {
        const fileExtensionPref = getFileExtension(doc.file_name);
        await __fallbackDocView(doc.id, fileExtensionPref);
        return;
    }
    // Otherwise, generate a signed URL with a longer expiry.
    const fileUrl = await getDocumentUrl(doc, { expiresIn: 3600 }); // 1 hour
        
        if (!fileUrl) {
            console.error('❌ No URL found for document');
            contentDiv.innerHTML = `
                <div class="no-preview">
                    <i class="fas fa-file"></i>
                    <p>Document URL not available</p>
                    <p>File: ${doc.file_name}</p>
                    <p>Debug: remote_url = ${doc.remote_url || 'null'}</p>
                </div>
            `;
            return;
        }

        console.log('🌐 Using URL:', fileUrl);
        const fileExtension = getFileExtension(doc.file_name);
        console.log('📄 File extension:', fileExtension);
        
    if (isImageFile(fileExtension)) {
            console.log('🖼️ Displaying as image');
            // Display image directly
            contentDiv.innerHTML = `
                <div class="document-preview image-preview">
                    <img id="doc-img-${doc.id}" src="${fileUrl}" alt="${doc.file_name}" 
                         style="max-width: 100%; max-height: 600px; object-fit: contain; opacity: 0; transition: opacity 0.3s;"
                         onload="console.log('✅ Image loaded successfully'); this.style.opacity='1'" 
                         onerror="console.error('❌ Image failed to load:', '${fileUrl}'); __fallbackDocView('${doc.id}', '${fileExtension}')" />
                    <div class="image-info">
                        <p class="file-name">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <button onclick="openDocumentInNewTab('${doc.id}')" class="btn-secondary">
                            <i class="fas fa-external-link-alt"></i> Open in New Tab
                        </button>
                        <button onclick="testImageUrl('${fileUrl}')" class="btn-secondary">
                            <i class="fas fa-vial"></i> Test URL
                        </button>
                    </div>
                </div>
            `;
        } else if (fileExtension === 'pdf') {
            console.log('📑 Displaying as PDF');
            // Display PDF using iframe
            contentDiv.innerHTML = `
                <div class="document-preview pdf-preview">
                    <iframe id="doc-pdf-${doc.id}" src="${fileUrl}" 
                            style="width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 8px;"
                            title="PDF Viewer - ${doc.file_name}">
                        <p>Your browser doesn't support PDF viewing. 
                           <a href="javascript:void(0)" onclick="openDocumentInNewTab('${doc.id}')">Click here to open PDF</a>
                        </p>
                    </iframe>
                    <div class="pdf-info">
                        <p class="file-name">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <button onclick="openDocumentInNewTab('${doc.id}')" class="btn-secondary">
                            <i class="fas fa-external-link-alt"></i> Open in New Tab
                        </button>
                        <button onclick="__fallbackDocView('${doc.id}', 'pdf')" class="btn-secondary">
                            <i class="fas fa-file-download"></i> Try Fallback
                        </button>
                    </div>
                </div>
            `;
        } else {
            console.log('📄 Displaying as file');
            // Show file info for other types
            contentDiv.innerHTML = `
                <div class="document-preview file-preview">
                    <div class="file-icon">
                        <i class="fas fa-file-${getFileTypeIcon(fileExtension)}"></i>
                    </div>
                    <div class="file-details">
                        <p class="file-name">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <p class="file-type">Type: ${fileExtension.toUpperCase()}</p>
                        <button onclick="openDocumentInNewTab('${doc.id}')" class="btn-secondary">
                            <i class="fas fa-download"></i> Download / Open
                        </button>
                        <button onclick="__fallbackDocView('${doc.id}', '${fileExtension}')" class="btn-secondary">
                            <i class="fas fa-file-download"></i> Try Fallback
                        </button>
                    </div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ Error loading document content:', error);
        contentDiv.innerHTML = `
            <div class="error-preview">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading document</p>
                <p class="error-details">${error.message}</p>
            </div>
        `;
    }
}

// Parse a Supabase Storage URL and extract bucket + object path. Supports
// both public and signed URL formats and strips any query string.
function parseStorageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const u = new URL(url);
        // Drop query string when deriving object path
        const pathname = u.pathname;
        // Expected patterns:
        // - /storage/v1/object/public/<bucket>/<object>
        // - /storage/v1/object/sign/<bucket>/<object>
        const parts = pathname.split('/').filter(Boolean);
        const idx = parts.findIndex(p => p === 'object');
        if (idx === -1 || parts.length < idx + 3) return null;
        const kind = parts[idx + 1]; // 'public' or 'sign' or possibly bucket directly in older formats
        let bucket, objectPath;
        if (kind === 'public' || kind === 'sign') {
            bucket = parts[idx + 2];
            objectPath = parts.slice(idx + 3).join('/');
        } else {
            // Fallback: /object/<bucket>/<object>
            bucket = parts[idx + 1];
            objectPath = parts.slice(idx + 2).join('/');
        }
        if (!bucket || !objectPath) return null;
        return { bucket, path: objectPath };
    } catch (_) {
        return null;
    }
}

function getDocumentUrl(doc, options = {}) {
    const { expiresIn = 3600, forceSigned = false } = options;
    // Use remote_url directly if available. If it's missing or inaccessible
    // (for example the bucket is private), try to generate a short-lived
    // signed URL from Supabase Storage as a fallback.
    return (async function() {
        const initialUrl = doc.remote_url || doc.url || null;
        console.log('🔗 Getting document URL (initial):', initialUrl);

        // If there's an existing URL, do a lightweight HEAD check to detect
        // authorization errors (401/403). If the check fails or is blocked by
        // CORS, fall back to signed URL generation when possible.
        if (initialUrl && !forceSigned) {
            // If the initial URL already looks like a signed URL (has token
            // query string or uses /sign/), DON'T trust it (it may be expired).
            // We'll prefer generating a fresh signed URL below.
            const looksSigned = /[?&]token=/.test(initialUrl) || /\/storage\/v1\/object\/sign\//.test(initialUrl);
            if (!looksSigned) {
                try {
                    const resp = await fetch(initialUrl, { method: 'HEAD' });
                    if (resp.ok) {
                        console.log('✅ Remote URL is accessible:', initialUrl);
                        return initialUrl;
                    }
                    console.warn('⚠️ Remote URL returned non-ok status:', resp.status, initialUrl);
                    if (resp.status !== 401 && resp.status !== 403) {
                        // Return URL for non-auth errors (let iframe/img handle it)
                        return initialUrl;
                    }
                } catch (err) {
                    console.warn('⚠️ HEAD request failed (possible CORS or network):', err.message || err);
                    // Continue to attempt signed URL generation
                }
            } else {
                console.log('ℹ️ Stored URL appears to be signed; will generate a fresh one to avoid expired token.');
            }
        }

        // Try to determine object path for Supabase storage. Prefer explicit
        // fields saved in DB like `file_path` or `path`, otherwise attempt to
        // extract it from the stored remote_url.
        let objectPath = doc.file_path || doc.path || doc.filePath || null;
        let bucketName = doc.bucket || 'insurevis-documents';
        if (!objectPath && initialUrl) {
            const parsed = parseStorageUrl(initialUrl);
            if (parsed) {
                bucketName = parsed.bucket || bucketName;
                objectPath = parsed.path;
                console.log('🔎 Extracted from URL -> bucket:', bucketName, 'path:', objectPath);
            }
        }

        // If we have an object path and a Supabase client, request a signed URL
        if (objectPath && typeof supabase !== 'undefined') {
            try {
                console.log('🔐 Attempting to create signed URL for:', objectPath, 'expiresIn:', expiresIn, 'bucket:', bucketName);
                const { data, error } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(objectPath, expiresIn);

                if (error) {
                    console.error('❌ Failed to create signed URL:', error.message || error);
                } else if (data && data.signedUrl) {
                    console.log('✅ Signed URL obtained');
                    return data.signedUrl;
                }
            } catch (err) {
                console.error('❌ Error while creating signed URL:', err.message || err);
            }
        }

        // Last resort: return whatever we have (may be null)
        return initialUrl;
    })();
}

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function isImageFile(extension) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    return imageExtensions.includes(extension);
}

async function saveDocumentVerification() {
    if (currentClaimApproved) {
        showError('Claim is approved. Documents are view-only.');
        return;
    }
    const documentId = document.getElementById('saveVerification').dataset.documentId;
    const isVerified = document.getElementById('verifyCheckbox').checked;
    const notes = document.getElementById('verificationNotes').value.trim();

    if (!documentId) {
        showError('No document selected');
        return;
    }

    try {
        const updateData = {
            verified_by_car_company: isVerified,
            car_company_verification_notes: notes || null
        };

        if (isVerified) {
            updateData.car_company_verification_date = new Date().toISOString();
        } else {
            updateData.car_company_verification_date = null;
        }

        const { error } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', documentId);

        if (error) {
            console.error('Error updating document verification:', error);
            showError('Failed to save verification status');
            return;
        }

        // Update current documents array
        const docIndex = currentDocuments.findIndex(doc => doc.id === documentId);
        if (docIndex !== -1) {
            currentDocuments[docIndex] = { ...currentDocuments[docIndex], ...updateData };
        }

        // If this action unverified a document, immediately mark the claim as not approved by car company
        if (!isVerified && currentClaim) {
            try {
                await supabase
                    .from('claims')
                    .update({ is_approved_by_car_company: false, car_company_approval_date: null })
                    .eq('id', currentClaim);
            } catch (e) {
                console.warn('Failed to set claim car-company approval to false after unverify:', e);
            }
        }

        // Safety guard: if the platform auto-flipped the claim to approved when all
        // docs are verified, revert it here. Only revert if the claim is not in a
        // final approved/submitted state (those are set explicitly via Approve).
        try {
            const allDocsVerified = Array.isArray(currentDocuments) && currentDocuments.length > 0 && currentDocuments.every(d => !!d.verified_by_car_company);
            if (currentClaim && allDocsVerified) {
                const { data: claimRow, error: claimFetchErr } = await supabase
                    .from('claims')
                    .select('is_approved_by_car_company, status')
                    .eq('id', currentClaim)
                    .single();
                if (!claimFetchErr && claimRow && claimRow.is_approved_by_car_company === true) {
                    const status = (claimRow.status || '').toLowerCase();
                    // Don't revert if claim was explicitly moved to submitted/approved via Approve button
                    if (status !== 'submitted' && status !== 'approved') {
                        await supabase
                            .from('claims')
                            .update({ is_approved_by_car_company: false })
                            .eq('id', currentClaim);
                    }
                }
            }
        } catch (guardErr) {
            console.warn('Guard: could not ensure claim approval stays manual-only:', guardErr);
        }

        // Refresh displays
        updateDocumentStats(currentDocuments);
        displayDocuments(currentDocuments);
        
        // Close modal
        closeDocumentViewer();

        // Show success message
        showSuccess(isVerified ? 'Document verified successfully!' : 'Document verification removed');

        // Reload claims to update counts
        setTimeout(() => {
            loadClaims();
        }, 1000);

        // Immediately refresh decision buttons state so Approve enables without navigation
        try {
            if (currentClaim) {
                const { data: freshClaim, error: freshErr } = await supabase
                    .from('claims')
                    .select('id, status, is_approved_by_car_company')
                    .eq('id', currentClaim)
                    .single();
                if (!freshErr && freshClaim) {
                    setDecisionButtonsState(freshClaim);
                    applyApprovedState(freshClaim);
                }
            }
        } catch (btnErr) {
            console.warn('Could not refresh decision button state:', btnErr);
        }

    } catch (error) {
        console.error('Error saving verification:', error);
        showError('Failed to save verification status');
    }
}

// UI helpers for approval confirmation and approved state
function openApprovalConfirm() {
    const modal = document.getElementById('approvalConfirmModal');
    if (!modal) return decideClaim('approved');
    modal.style.display = 'flex';
    const confirmBtn = document.getElementById('confirmApproveBtn');
    if (confirmBtn) {
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', async () => {
            closeApprovalConfirm();
            await decideClaim('approved');
        });
    }
}

function closeApprovalConfirm() {
    const modal = document.getElementById('approvalConfirmModal');
    if (modal) modal.style.display = 'none';
}

function applyApprovedState(claim) {
    const approved = !!(claim && (claim.is_verified_by_car_company || claim.isVerifiedByCarCompany || claim.is_approved_by_car_company));
    currentClaimApproved = approved;
    const banner = document.getElementById('approvedBanner');
    const page = document.getElementById('documentsPage');
    const decisionActions = document.getElementById('carClaimDecisionActions');

    if (approved) {
        if (banner) banner.style.display = '';
        if (page) page.classList.add('view-only');
        document.body.classList.add('view-only');
        if (decisionActions) decisionActions.style.display = 'none';
        // Also disable controls in the document modal if open
        const checkbox = document.getElementById('verifyCheckbox');
        const notes = document.getElementById('verificationNotes');
        const saveBtn = document.getElementById('saveVerification');
        if (checkbox) checkbox.disabled = true;
        if (notes) notes.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
    } else {
        if (banner) banner.style.display = 'none';
        if (page) page.classList.remove('view-only');
        document.body.classList.remove('view-only');
        const checkbox = document.getElementById('verifyCheckbox');
        const notes = document.getElementById('verificationNotes');
        const saveBtn = document.getElementById('saveVerification');
        if (checkbox) checkbox.disabled = false;
        if (notes) notes.disabled = false;
        if (saveBtn) saveBtn.disabled = false;
    }
}

// Navigation functions
function showClaimsPage() {
    document.getElementById('claimsPage').classList.add('active');
    document.getElementById('documentsPage').classList.remove('active');
    currentClaim = null;
    document.body.classList.remove('claim-view-active');

    const decisionActions = document.getElementById('carClaimDecisionActions');
    if (decisionActions) {
        decisionActions.style.display = 'none';
    }
}

function showDocumentsPage() {
    document.getElementById('claimsPage').classList.remove('active');
    document.getElementById('documentsPage').classList.add('active');
    document.body.classList.add('claim-view-active');
}

function closeDocumentViewer() {
    document.getElementById('documentViewerModal').style.display = 'none';
    document.getElementById('saveVerification').dataset.documentId = '';
}

// Filter functions
function filterClaims() {
    const searchTerm = document.getElementById('claimsSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    const rows = document.querySelectorAll('.claim-row');
    
    rows.forEach(row => {
        const claimNumber = row.querySelector('td:first-child').textContent.toLowerCase();
        const userName = row.querySelector('.user-name').textContent.toLowerCase();
        const userEmail = row.querySelector('.user-info small').textContent.toLowerCase();
        const status = row.querySelector('.status-badge').textContent.toLowerCase();
        
        const matchesSearch = !searchTerm || 
            claimNumber.includes(searchTerm) || 
            userName.includes(searchTerm) || 
            userEmail.includes(searchTerm);
            
        const matchesStatus = !statusFilter || status.includes(statusFilter.replace('_', ' '));
        
        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}

// Utility functions
function formatStatus(status) {
    if (!status) return '';
    const normalized = String(status).toLowerCase();
    // Centralized display mapping for special cases
    const displayMap = {
        'under_review': 'In Review',
        'pending_documents': 'Pending',
        'submitted': 'Submitted',
        'draft': 'Draft',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };
    if (displayMap[normalized]) return displayMap[normalized];
    // Fallback: convert snake_case or kebab-case to Title Case
    return normalized.split(/[_-]/).map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function testImageUrl(url) {
    console.log('🧪 Testing URL:', url);
    fetch(url, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                console.log('✅ URL is accessible', response.status);
                showSuccess('URL is accessible! Status: ' + response.status);
            } else {
                console.log('❌ URL returned error:', response.status, response.statusText);
                showError('URL error: ' + response.status + ' - ' + response.statusText);
            }
        })
        .catch(error => {
            console.error('❌ Network error:', error);
            showError('Network error: ' + error.message + '\nThis could be CORS, network, or authentication issues.');
        });
}

// On-demand open in a new tab with a fresh signed URL to avoid expired tokens.
async function openDocumentInNewTab(documentId) {
    try {
        const doc = currentDocuments.find(d => d.id === documentId);
        if (!doc) return;
        if (typeof PREFER_STORAGE_DOWNLOAD !== 'undefined' && PREFER_STORAGE_DOWNLOAD) {
            const { bucketName, objectPath } = resolveStorageObject(doc);
            const { data, error } = await supabase.storage.from(bucketName).download(objectPath);
            if (error || !data) {
                console.error('openDocumentInNewTab download error:', error || 'no data');
                showError('Unable to download the document for opening.');
                return;
            }
            const blobUrl = URL.createObjectURL(data);
            window.open(blobUrl, '_blank', 'noopener');
        } else {
            const freshUrl = await getDocumentUrl(doc, { expiresIn: 3600, forceSigned: true });
            if (freshUrl) {
                window.open(freshUrl, '_blank', 'noopener');
            } else if (doc.remote_url) {
                window.open(doc.remote_url, '_blank', 'noopener');
            } else {
                showError('Unable to generate URL for this document.');
            }
        }
    } catch (e) {
        console.error('openDocumentInNewTab error:', e);
        showError('Failed to open document: ' + (e.message || e));
    }
}

// Helper to resolve bucket and path for a document
function resolveStorageObject(doc) {
    let objectPath = doc.file_path || doc.path || doc.filePath || null;
    let bucketName = doc.bucket || 'insurevis-documents';
    const initialUrl = doc.remote_url || doc.url || null;
    if (!objectPath && initialUrl) {
        const parsed = parseStorageUrl(initialUrl);
        if (parsed) {
            bucketName = parsed.bucket || bucketName;
            objectPath = parsed.path;
        }
    }
    return { bucketName, objectPath };
}

// Fallback: download the file via Supabase Storage and render from a blob URL
async function __fallbackDocView(documentId, fileExtension) {
    try {
        const doc = currentDocuments.find(d => d.id === documentId);
        if (!doc) return;
        const { bucketName, objectPath } = resolveStorageObject(doc);
        if (!bucketName || !objectPath) {
            console.warn('Fallback cannot resolve storage object');
            showError('Unable to locate file path for fallback preview.');
            return;
        }
        console.log('↩️ Fallback download from bucket:', bucketName, 'path:', objectPath);
        const { data, error } = await supabase.storage.from(bucketName).download(objectPath);
        if (error || !data) {
            console.error('Fallback download error:', error || 'no data');
            showError('Fallback download failed: ' + (error?.message || 'Unknown error'));
            return;
        }
        const blobUrl = URL.createObjectURL(data);
        const contentDiv = document.getElementById('documentContent');

        if (isImageFile(fileExtension)) {
            contentDiv.innerHTML = `
                <div class="document-preview image-preview">
                    <img src="${blobUrl}" alt="${doc.file_name}" 
                         style="max-width: 100%; max-height: 600px; object-fit: contain; opacity: 0; transition: opacity 0.3s;"
                         onload="this.style.opacity='1'" />
                    <div class="image-info">
                        <p class="file-name">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <a href="${blobUrl}" download="${doc.file_name}" class="btn-secondary">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>`;
        } else if (fileExtension === 'pdf') {
            contentDiv.innerHTML = `
                <div class="document-preview pdf-preview">
                    <iframe src="${blobUrl}" 
                            style="width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 8px;"
                            title="PDF Viewer - ${doc.file_name}">
                        <p>Your browser doesn't support PDF viewing. 
                           <a href="${blobUrl}" download="${doc.file_name}">Download PDF</a>
                        </p>
                    </iframe>
                    <div class="pdf-info">
                        <p class="file-name">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <a href="${blobUrl}" download="${doc.file_name}" class="btn-secondary">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>`;
        } else {
            contentDiv.innerHTML = `
                <div class="document-preview file-preview">
                    <div class="file-icon">
                        <i class="fas fa-file-${getFileTypeIcon(fileExtension)}"></i>
                    </div>
                    <div class="file-details">
                        <p class="file-name">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <p class="file-type">Type: ${fileExtension.toUpperCase()}</p>
                        <a href="${blobUrl}" download="${doc.file_name}" class="btn-secondary">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>`;
        }
    } catch (e) {
        console.error('Fallback view failed:', e);
        showError('Fallback preview failed: ' + (e.message || e));
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function getDocumentIcon(type) {
    const icons = {
        'lto_or': 'fa-receipt',
        'lto_cr': 'fa-certificate',
        'drivers_license': 'fa-id-card',
        'owner_valid_id': 'fa-id-badge',
        'stencil_strips': 'fa-barcode',
        'damage_photos': 'fa-images',
        'job_estimate': 'fa-calculator'
    };
    return icons[type] || 'fa-file';
}

function getFileTypeIcon(format) {
    const icons = {
        'pdf': 'pdf',
        'jpg': 'image',
        'jpeg': 'image',
        'png': 'image',
        'doc': 'word',
        'docx': 'word'
    };
    return icons[format] || 'alt';
}

async function populateVehicleInformation(claimId, docObj) {
    try {
        // In a real application, this would fetch vehicle data from the database
        // For now, we'll use sample data based on the claim ID
    const vehicleInfo = currentVehicleInfo || getVehicleInfoForClaim(claimId);

    // Use the global `document` (DOM) to populate fields. The parameter
    // was renamed to `docObj` to avoid shadowing the browser `document`.
    document.getElementById('vehicleMake').textContent = vehicleInfo.make || '-';
    document.getElementById('vehicleModel').textContent = vehicleInfo.model || '-';
    document.getElementById('vehicleYear').textContent = vehicleInfo.year || '-';
    document.getElementById('licensePlate').textContent = vehicleInfo.licensePlate || '-';

    } catch (error) {
        console.error('Error populating vehicle information:', error);
        // Set default values if there's an error
        document.getElementById('vehicleMake').textContent = '-';
        document.getElementById('vehicleModel').textContent = '-';
        document.getElementById('vehicleYear').textContent = '-';
        document.getElementById('licensePlate').textContent = '-';
    }
}

function getVehicleInfoForClaim(claimId) {
    // Sample vehicle data - in a real application, this would come from the database
    const vehicleData = {
        'claim-001': {
            make: 'Toyota',
            model: 'Camry',
            year: '2020',
            licensePlate: 'ABC-1234'
        },
        'claim-002': {
            make: 'Honda',
            model: 'Civic',
            year: '2019',
            licensePlate: 'XYZ-5678'
        }
    };
    
    return vehicleData[claimId] || {
        make: 'Unknown',
        model: 'Unknown',
        year: 'Unknown',
        licensePlate: 'Unknown'
    };
}

// Toast/Pane notifications
function notify(type, title, message, timeout = 4000) {
    try {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('toastContainer not found');
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '⚠️' : type === 'warning' ? '⚠️' : 'ℹ️'}</div>
            <div class="toast-content">
                <div class="toast-title">${title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Notice')}</div>
                <div class="toast-message">${message || ''}</div>
            </div>
            <button class="toast-close" aria-label="Close">×</button>
        `;
        const closer = toast.querySelector('.toast-close');
        closer.addEventListener('click', () => container.removeChild(toast));
        container.appendChild(toast);
        if (timeout > 0) setTimeout(() => {
            if (toast.parentNode === container) container.removeChild(toast);
        }, timeout);
    } catch (e) { console.warn('notify error', e); }
}

function showError(message) { notify('error', 'Error', message); }
function showSuccess(message) { notify('success', 'Success', message); }

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('documentViewerModal');
    if (event.target === modal) {
        closeDocumentViewer();
    }
    const confirmModal = document.getElementById('approvalConfirmModal');
    if (event.target === confirmModal) {
        closeApprovalConfirm();
    }
});
