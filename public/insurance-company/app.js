// Insurance Company Portal - Document Verification & Claims Approval System
// Supabase Configuration
const supabaseUrl = 'https://vvnsludqdidnqpbzzgeb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bnNsdWRxZGlkbnFwYnp6Z2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg3MjIsImV4cCI6MjA3MDcyNDcyMn0.aFtPK2qhVJw3z324PjuM-q7e5_4J55mgm7A2fqkLO3c';

const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Global variables
let currentClaim = null;
let currentClaimData = null;
let currentDocuments = [];
let currentClaimApproved = false;

// Insurance company verifiable document types
const INSURANCE_DOCUMENT_TYPES = [
    'police_report',
    'insurance_policy',
    'drivers_license',
    'owner_valid_id',
    'job_estimate',
    'damage_photos',
    'lto_or',
    'lto_cr',
    'additional_documents'
];

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
        if (role !== 'insurance_company') {
            const destination = ROLE_ROUTES[role] || '/';
            redirectTo(destination);
            return;
        }

        initializeApp();
    } catch (error) {
        console.error('Failed to initialise insurance company portal:', error);
        redirectTo('/');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', bootstrapPortal);

async function initializeApp() {
    console.log('Initializing Insurance Company Portal...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load claims data
    await loadClaims();
}

function setupEventListeners() {
    // Helper function to safely add event listeners
    function addEventListenerSafely(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with ID '${id}' not found. Skipping event listener.`);
        }
    }
    
    // Search functionality
    addEventListenerSafely('claimsSearch', 'input', filterClaims);
    addEventListenerSafely('statusFilter', 'change', filterClaims);
    
    // Navigation
    addEventListenerSafely('backToClaims', 'click', showClaimsPage);
    
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
    addEventListenerSafely('saveVerification', 'click', saveDocumentVerification);
    
    // Claim approval
    // Approve should open the approval modal (insurance flow)
    addEventListenerSafely('approveClaimBtn', 'click', showApprovalModal);
    // For Car Company decisions (approve/reject/hold) wire to decideClaim
    addEventListenerSafely('rejectClaimBtn', 'click', function() { decideClaim('rejected'); });
    addEventListenerSafely('holdClaimBtn', 'click', function() { decideClaim('under_review'); });
}

function showDecisionModal(action) {
    if (!currentClaim) return;
    const approvalModal = document.getElementById('approvalModal');
    const confirmBtn = document.getElementById('confirmApproval');
    // store action on the confirm button for handling
    confirmBtn.dataset.action = action;

    // update modal copy
    const title = approvalModal.querySelector('.modal-header h3');
    const desc = approvalModal.querySelector('.approval-confirmation p');
    if (action === 'reject') {
        title.innerHTML = '<i class="fas fa-times-circle"></i> Reject Claim';
        desc.textContent = 'Are you sure you want to reject this claim? This will mark the claim as rejected.';
    } else if (action === 'hold') {
        title.innerHTML = '<i class="fas fa-pause-circle"></i> Hold Claim';
        desc.textContent = 'Put this claim on hold (mark as under_review). You can resume later.';
    }

    // show modal
    approvalModal.style.display = 'flex';
}

// override confirmApproval handler to dispatch based on chosen action
const originalApproveClaim = approveClaim;
document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmApproval');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async function() {
            const action = this.dataset.action || 'approve';
            if (action === 'approve') {
                // perform the normal insurance approval
                await originalApproveClaim();

                // attempt to notify the claim owner about the approval
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
                            await sendNotifToUser(userId, 'Claim Approved', `Your claim ${claimNumber} has been approved.`, 'approved');
                        } else {
                            console.warn('confirmApproval: could not determine user_id to notify (approve)');
                        }
                    } catch (e) {
                        console.warn('confirmApproval: error resolving claim user_id for approve notification', e);
                    }
                })();

            } else if (action === 'reject') {
                // Use decideClaim which handles DB update + notification for car company decisions
                await decideClaim('rejected');
            } else if (action === 'hold') {
                await decideClaim('under_review');
            }
            // clear action and close modal
            this.dataset.action = '';
            closeApprovalModal();
        });
    }
});

async function performClaimAction(status, extraFields = {}) {
    if (!currentClaim) return;
    try {
        const updatePayload = { status, ...extraFields };
        const { error } = await supabase
            .from('claims')
            .update(updatePayload)
            .eq('id', currentClaim);

        if (error) {
            console.error('Error updating claim status:', error);
            showError('Failed to update claim status');
            return;
        }

        showSuccess(`Claim ${formatStatus(status)} successfully!`);
        // Refresh data and UI
        setTimeout(() => {
            showClaimsPage();
            loadClaims();
        }, 800);

    } catch (err) {
        console.error('performClaimAction error:', err);
        showError('Failed to update claim');
    }
}


// Decision helper for Car Company (approve/reject/under_review)
async function decideClaim(decision) {
    if (!currentClaim) {
        showError('No claim selected');
        return;
    }

    try {
        const updateData = {};
        if (decision === 'approved') {
            updateData.status = 'approved';
            // Mark claim as approved by car company
            updateData.is_approved_by_car_company = true;

            // Notify claim owner (resolve user id then send)
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
            updateData.status = 'rejected';
            // mark as not approved by car company
            updateData.is_approved_by_car_company = false;

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
        const decisionActionsEl = document.getElementById('claimDecisionActions');
        if (decisionActionsEl) decisionActionsEl.style.display = 'none';
        showSuccess(decision === 'approved' ? 'Claim approved' : decision === 'rejected' ? 'Claim rejected' : 'Claim marked as Under Review');
        // Refresh claims and claim details
        await loadClaims();
        await loadClaimDocuments(currentClaim);

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

// Claims Management
async function loadClaims() {
    const loadingElement = document.getElementById('loadingClaims');
    const tableBody = document.getElementById('claimsTableBody');
    
    loadingElement.style.display = 'block';
    
    try {
        // Fetch claims with user information and document counts
        // Only show claims where ALL car company documents are verified
        const { data: claims, error } = await supabase
            .from('claims')
            .select(`
                *,
                users:user_id (
                    name,
                    email
                ),
                documents (
                    id,
                    type,
                    verified_by_car_company,
                    verified_by_insurance_company
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching claims:', error);
            showError('Failed to load claims');
            return;
        }

        console.log('Loaded claims:', claims);
        
        // Filter claims to only show those where ALL car company documents are verified
        const eligibleClaims = claims.filter(claim => {
            const carCompanyDocs = claim.documents.filter(doc => 
                CAR_COMPANY_DOCUMENT_TYPES.includes(doc.type)
            );
            
            // If there are no car company documents, claim is not eligible
            if (carCompanyDocs.length === 0) {
                return false;
            }
            
            // All car company documents must be verified
            return carCompanyDocs.every(doc => doc.verified_by_car_company);
        });
        
        // Process eligible claims data
        const processedClaims = eligibleClaims.map(claim => {
            const insuranceDocs = claim.documents.filter(doc => 
                INSURANCE_DOCUMENT_TYPES.includes(doc.type)
            );
            const verifiedInsuranceDocs = insuranceDocs.filter(doc => 
                doc.verified_by_insurance_company
            );
            
            const allDocsVerified = insuranceDocs.length > 0 && 
                insuranceDocs.every(doc => doc.verified_by_insurance_company);
            
            return {
                ...claim,
                totalInsuranceDocs: insuranceDocs.length,
                verifiedInsuranceDocs: verifiedInsuranceDocs.length,
                pendingInsuranceDocs: insuranceDocs.length - verifiedInsuranceDocs.length,
                readyForApproval: allDocsVerified
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
                    <p>No claims ready for insurance verification</p>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = claims.map(claim => `
        <tr class="claim-row ${((claim.is_approved_by_insurance_company || claim.status === 'approved') ? 'approved-row' : '')}" data-claim-id="${claim.id}">
            <td>
                <strong>${claim.claim_number}</strong>
            </td>
            <td>
                <div class="user-info">
                    <span class="user-name">${claim.users?.name || 'Unknown'}</span>
                    <small>${claim.users?.email || ''}</small>
                </div>
            </td>
            <td>
                <span class="status-badge status-${claim.status}">
                    ${formatStatus(claim.status)}
                </span>
            </td>
            <td>
                <div class="verification-status">
                    ${claim.is_approved_by_car_company ? 
                        '<i class="fas fa-check-circle text-success"></i> Verified' : 
                        '<i class="fas fa-clock text-warning"></i> Pending'
                    }
                </div>
            </td>
            <td>
                <div class="verification-status">
                    ${claim.is_approved_by_insurance_company ? 
                        '<i class="fas fa-check-circle text-success"></i> Verified' : 
                        '<i class="fas fa-clock text-warning"></i> Pending'
                    }
                </div>
            </td>
            <td>
                <span class="doc-count">${claim.totalInsuranceDocs}</span>
            </td>
            <td>
                <span class="pending-count ${claim.pendingInsuranceDocs > 0 ? 'has-pending' : ''}">
                    ${claim.pendingInsuranceDocs}
                </span>
            </td>
            <td>
                <span class="date">${formatDate(claim.created_at)}</span>
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
    
    // Verify this claim is eligible for insurance review
    const { data: claim, error: claimError } = await supabase
        .from('claims')
        .select(`
            *,
            documents (
                id,
                type,
                verified_by_car_company
            )
        `)
        .eq('id', claimId)
        .single();

    if (claimError) {
        console.error('Error fetching claim:', claimError);
        showError('Failed to load claim details');
        return;
    }

    // Check if all car company documents are verified
    const carCompanyDocs = claim.documents.filter(doc => 
        CAR_COMPANY_DOCUMENT_TYPES.includes(doc.type)
    );
    
    const allCarDocsVerified = carCompanyDocs.length > 0 && 
        carCompanyDocs.every(doc => doc.verified_by_car_company);
    
    if (!allCarDocsVerified) {
        showError('This claim is not ready for insurance review. All car company documents must be verified first.');
        return;
    }
    
    // Show documents page
    showDocumentsPage();
    
    // Load documents for this claim
    await loadClaimDocuments(claimId);
}

async function loadClaimDocuments(claimId) {
    const loadingElement = document.getElementById('loadingDocuments');
    
    loadingElement.style.display = 'block';
    
    try {
        // Fetch claim details
        const { data: claim, error: claimError } = await supabase
            .from('claims')
            .select(`
                *,
                users:user_id (name, email)
            `)
            .eq('id', claimId)
            .single();

        if (claimError) {
            console.error('Error fetching claim:', claimError);
            showError('Failed to load claim details');
            return;
        }

    // Store claim data globally for use in document viewer
        currentClaimData = claim;
    // Track approval state
    currentClaimApproved = !!(claim.is_approved_by_insurance_company || claim.status === 'approved');

        // Update claim header
        document.getElementById('claimTitle').textContent = `Claim ${claim.claim_number}`;
        document.getElementById('claimDescription').textContent = 
            `Documents for ${claim.users?.name || 'Unknown User'} - Insurance Verification & Approval`;

        // Populate the User Summary card (above the incident details)
        try {
            const userNameEl = document.getElementById('userName');
            const userEmailEl = document.getElementById('userEmail');
            const userPhoneEl = document.getElementById('userPhone');

            // Prefer joined user data if present
            let user = claim.users || null;

            // If we don't have full user info (or phone is missing), fetch from users table using user_id
            if ((!user || !user.email || !user.name || !user.phone) && claim.user_id) {
                try {
                    const { data: fullUser, error: userErr } = await supabase
                        .from('users')
                        .select('id, name, email, phone, phone_number, mobile, contact_number')
                        .eq('id', claim.user_id)
                        .single();

                    if (!userErr && fullUser) {
                        // normalize field names onto `user`
                        user = {
                            id: fullUser.id,
                            name: fullUser.name,
                            email: fullUser.email,
                            phone: fullUser.phone || fullUser.phone_number || fullUser.mobile || fullUser.contact_number || null
                        };
                    }
                } catch (e) {
                    console.warn('Error fetching full user by user_id:', e);
                }
            }

            const phone = user ? (user.phone || user.phone_number || user.mobile || user.contact_number || '-') : '-';

            if (userNameEl) userNameEl.textContent = user && user.name ? user.name : '-';
            if (userEmailEl) userEmailEl.textContent = user && user.email ? user.email : '-';
            if (userPhoneEl) userPhoneEl.textContent = phone || '-';
        } catch (err) {
            console.warn('Could not populate user summary card:', err);
        }

        // Populate the Incident Details card (below the approval section)
        try {
            const incidentIdEl = document.getElementById('incidentId');
            const incidentDateCardEl = document.getElementById('incidentDateCard');
            const incidentPlaceCardEl = document.getElementById('incidentPlaceCard');
            const incidentStatusCardEl = document.getElementById('incidentStatusCard');
            const incidentDescriptionCardEl = document.getElementById('incidentDescriptionCard');
            const incidentEstimatedCostEl = document.getElementById('incidentEstimatedCost');

            if (incidentIdEl) incidentIdEl.textContent = claim.claim_number || claim.id || '-';
            if (incidentDateCardEl) incidentDateCardEl.textContent = claim.incident_date ? formatDate(claim.incident_date) : '-';
            if (incidentPlaceCardEl) incidentPlaceCardEl.textContent = claim.incident_location || '-';
            if (incidentStatusCardEl) incidentStatusCardEl.textContent = claim.status ? formatStatus(claim.status) : '-';
            if (incidentDescriptionCardEl) incidentDescriptionCardEl.textContent = claim.incident_description || '-';
            // Estimated cost - prefer explicit field names that may exist on the claim
            // Common field names: estimated_cost, estimatedRepairCost, estimated_repair_cost
            const costValue = claim.estimated_cost ?? claim.estimatedRepairCost ?? claim.estimated_repair_cost ?? claim.estimated_damage_cost ?? null;
            if (incidentEstimatedCostEl) incidentEstimatedCostEl.textContent = costValue !== null && costValue !== undefined ? formatCurrency(costValue) : '-';
        } catch (err) {
            // Non-fatal - if elements are missing just log
            console.warn('Could not populate incident details card:', err);
        }

        // Fetch all documents for this claim
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('claim_id', claimId)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

        if (docsError) {
            console.error('Error fetching documents:', docsError);
            showError('Failed to load documents');
            return;
        }

        console.log('Loaded documents:', documents);
        currentDocuments = documents;

        // Separate documents by verification responsibility
        const insuranceDocuments = documents.filter(doc => 
            INSURANCE_DOCUMENT_TYPES.includes(doc.type)
        );
        const carDocuments = documents.filter(doc => 
            CAR_COMPANY_DOCUMENT_TYPES.includes(doc.type) && 
            !INSURANCE_DOCUMENT_TYPES.includes(doc.type)
        );

        // Update stats
        updateDocumentStats(documents, insuranceDocuments);
        
        // Display documents
        displayInsuranceDocuments(insuranceDocuments);
        displayCarDocuments(carDocuments);

    // Update approval button status
        updateApprovalButtonStatus(insuranceDocuments);

    // Apply approved state (banner and view-only UI)
    applyApprovedState();

    } catch (error) {
        console.error('Error loading claim documents:', error);
        showError('Failed to load documents');
    } finally {
        loadingElement.style.display = 'none';
    }
}

function updateDocumentStats(allDocuments, insuranceDocuments) {
    const carVerified = allDocuments.filter(doc => doc.verified_by_car_company).length;
    const insuranceVerified = insuranceDocuments.filter(doc => doc.verified_by_insurance_company).length;
    const pendingInsurance = insuranceDocuments.filter(doc => !doc.verified_by_insurance_company).length;
    const total = allDocuments.length;

    document.getElementById('carVerifiedDocs').textContent = carVerified;
    document.getElementById('insuranceVerifiedDocs').textContent = insuranceVerified;
    document.getElementById('pendingInsuranceDocs').textContent = pendingInsurance;
    document.getElementById('totalDocs').textContent = total;
}

function displayInsuranceDocuments(documents) {
    const documentsGrid = document.getElementById('insuranceDocumentsGrid');
    
    if (!documents || documents.length === 0) {
        documentsGrid.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>No insurance verifiable documents found for this claim</p>
            </div>
        `;
        return;
    }

    documentsGrid.innerHTML = documents.map(doc => `
        <div class="document-card ${doc.verified_by_insurance_company ? 'verified' : 'pending'}" 
             data-document-id="${doc.id}">
            <div class="document-header">
                <div class="document-type">
                    <i class="fas ${getDocumentIcon(doc.type)}"></i>
                    <span>${DOCUMENT_TYPE_NAMES[doc.type] || doc.type}</span>
                </div>
                <div class="verification-badge">
                    ${doc.verified_by_insurance_company ? 
                        '<i class="fas fa-check-circle verified"></i>' : 
                        '<i class="fas fa-clock pending"></i>'
                    }
                </div>
            </div>
            
            <div class="document-info">
                <p class="file-name">${doc.file_name}</p>
                <p class="upload-date">Uploaded: ${formatDate(doc.created_at)}</p>
                ${doc.insurance_verification_date ? 
                    `<p class="verified-date">Verified: ${formatDate(doc.insurance_verification_date)}</p>` : 
                    ''
                }
            </div>

            <div class="verification-indicators">
                ${doc.verified_by_car_company ? 
                    '<span class="car-verified"><i class="fas fa-car"></i> Car Verified</span>' : ''
                }
                ${doc.verified_by_insurance_company ? 
                    '<span class="insurance-verified"><i class="fas fa-shield-alt"></i> Insurance Verified</span>' : ''
                }
            </div>

            <div class="document-actions">
                <button class="btn-primary" onclick="viewDocument('${doc.id}', ${!currentClaimApproved})">
                    <i class="fas fa-eye"></i> ${currentClaimApproved ? 'View' : 'View & Verify'}
                </button>
            </div>

            ${doc.is_primary ? '<div class="primary-badge">Primary Document</div>' : ''}
        </div>
    `).join('');
}

function displayCarDocuments(documents) {
    const documentsGrid = document.getElementById('carDocumentsGrid');
    
    if (!documents || documents.length === 0) {
        documentsGrid.innerHTML = `
            <div class="no-data">
                <i class="fas fa-info-circle"></i>
                <p>No car company exclusive documents for this claim</p>
            </div>
        `;
        return;
    }

    documentsGrid.innerHTML = documents.map(doc => `
        <div class="document-card readonly verified" data-document-id="${doc.id}">
            <div class="document-header">
                <div class="document-type">
                    <i class="fas ${getDocumentIcon(doc.type)}"></i>
                    <span>${DOCUMENT_TYPE_NAMES[doc.type] || doc.type}</span>
                </div>
                <div class="verification-badge">
                    <i class="fas fa-check-circle verified"></i>
                </div>
            </div>
            
            <div class="document-info">
                <p class="file-name">${doc.file_name}</p>
                <p class="upload-date">Uploaded: ${formatDate(doc.created_at)}</p>
                <p class="verified-date">Car Verified: ${formatDate(doc.car_company_verification_date)}</p>
            </div>

            <div class="verification-indicators">
                <span class="car-verified"><i class="fas fa-car"></i> Car Company Verified</span>
            </div>

            <div class="document-actions">
                <button class="btn-secondary" onclick="viewDocument('${doc.id}', false)">
                    <i class="fas fa-eye"></i> View Only
                </button>
            </div>

            ${doc.is_primary ? '<div class="primary-badge">Primary Document</div>' : ''}
        </div>
    `).join('');
}

async function viewDocument(documentId, canVerify) {
    const doc = currentDocuments.find(d => d.id === documentId);
    if (!doc) {
        showError('Document not found');
        return;
    }

    // Populate modal with document information
    document.getElementById('documentTitle').textContent = DOCUMENT_TYPE_NAMES[doc.type] || doc.type;
    document.getElementById('docType').textContent = DOCUMENT_TYPE_NAMES[doc.type] || doc.type;
    document.getElementById('docFileName').textContent = doc.file_name;
    document.getElementById('docUploadDate').textContent = formatDate(doc.created_at);
    document.getElementById('docStatus').textContent = formatStatus(doc.status);

    // Incident information removed from document viewer modal; details are shown
    // on the Documents page incident card instead.

    // Show/hide verification controls based on whether this document can be verified by insurance
    const verificationSection = document.getElementById('verificationSection');
    const readonlyNotice = document.getElementById('readonlyNotice');
    
    if (canVerify && !currentClaimApproved) {
        verificationSection.style.display = 'block';
        readonlyNotice.classList.remove('show');
        
        // Set verification status
        const verifyCheckbox = document.getElementById('verifyCheckbox');
        const verificationNotes = document.getElementById('verificationNotes');
        
        verifyCheckbox.checked = doc.verified_by_insurance_company;
        verificationNotes.value = doc.insurance_verification_notes || '';
        
        // Store current document ID for saving
        document.getElementById('saveVerification').dataset.documentId = documentId;
        
        // Update checkbox label and button text based on verification status
        const checkboxLabel = document.querySelector('.checkbox-label');
        const saveButton = document.getElementById('saveVerification');
        
        if (checkboxLabel) {
            if (doc.verified_by_insurance_company) {
                checkboxLabel.textContent = 'Document is verified for insurance company requirements';
            } else {
                checkboxLabel.textContent = 'Verify this document for insurance company requirements';
            }
        }
        
        if (saveButton) {
            if (doc.verified_by_insurance_company) {
                saveButton.innerHTML = '<i class="fas fa-check"></i> Update Verification';
            } else {
                saveButton.innerHTML = '<i class="fas fa-check"></i> Verify Document';
            }
        }
        
    } else {
        verificationSection.style.display = 'none';
        readonlyNotice.classList.add('show');
    }

    // Load document content
    await loadDocumentContent(doc);

    // Set up action button handlers
    const openInNewTabBtn = document.getElementById('openInNewTab');
    const nextDocumentBtn = document.getElementById('nextDocument');
    
    if (openInNewTabBtn) {
        openInNewTabBtn.onclick = () => {
            if (doc.remote_url || doc.storage_path) {
                window.open(doc.remote_url || doc.storage_path, '_blank');
            } else {
                showError('Document URL not available');
            }
        };
    }
    
    if (nextDocumentBtn) {
        nextDocumentBtn.onclick = () => {
            // Find next document in the current documents array
            const currentIndex = currentDocuments.findIndex(d => d.id === documentId);
            const nextIndex = (currentIndex + 1) % currentDocuments.length;
            const nextDoc = currentDocuments[nextIndex];
            
            if (nextDoc && nextDoc.id !== documentId) {
                const canVerifyNext = INSURANCE_DOCUMENT_TYPES.includes(nextDoc.type);
                viewDocument(nextDoc.id, canVerifyNext);
            }
        };
    }

    // Show modal
    document.getElementById('documentViewerModal').style.display = 'flex';
}

async function loadDocumentContent(doc) {
    const contentDiv = document.getElementById('documentContent');
    
    if (!doc.remote_url && !doc.storage_path) {
        contentDiv.innerHTML = `
            <div class="default-document-preview">
                <div class="document-placeholder">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' fill='%23e2e8f0'%3E%3Crect width='200' height='250' fill='%23f7fafc'/%3E%3Cpath d='M50 30h100v20H50zm0 40h120v15H50zm0 30h80v15H50zm0 30h100v15H50z' fill='%23cbd5e0'/%3E%3C/svg%3E" alt="Document placeholder" class="document-placeholder-img">
                    <div class="document-info-text">
                        <p class="document-filename">${doc.file_name}</p>
                        <p class="document-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <p style="color: #666; margin: 8px 0 0 0; font-size: 13px;">Document preview not available</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    try {
        const fileUrl = doc.remote_url || doc.storage_path;
        const fileFormat = doc.format ? doc.format.toLowerCase() : '';
        
        // Handle different document types
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileFormat)) {
            // Image documents - use the new layout style
            contentDiv.innerHTML = `
                <div class="image-preview">
                    <img src="${fileUrl}" alt="${doc.file_name}" 
                         style="max-width: 100%; max-height: 500px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"
                         onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'error-preview\\'><i class=\\'fas fa-exclamation-triangle\\'></i><p>Failed to load image</p><div class=\\'document-info-text\\'><p class=\\'document-filename\\'>${doc.file_name}</p><p class=\\'document-size\\'>${formatFileSize(doc.file_size_bytes)}</p></div></div>';">
                    <div class="image-info">
                        <p class="file-info">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                    </div>
                </div>
            `;
        } else if (fileFormat === 'pdf') {
            // PDF documents
            contentDiv.innerHTML = `
                <div class="pdf-preview">
                    <embed src="${fileUrl}" type="application/pdf" 
                           style="width: 100%; height: 500px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div class="pdf-fallback">
                        <p class="file-info">${doc.file_name}</p>
                        <p class="file-size">${formatFileSize(doc.file_size_bytes)}</p>
                        <a href="${fileUrl}" target="_blank" class="btn-primary">
                            <i class="fas fa-external-link-alt"></i> Open PDF in New Tab
                        </a>
                    </div>
                </div>
            `;
        } else {
            // Other document types or fallback with placeholder
            contentDiv.innerHTML = `
                <div class="default-document-preview">
                    <div class="document-placeholder">
                        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' fill='%23e2e8f0'%3E%3Crect width='200' height='250' fill='%23f7fafc'/%3E%3Cpath d='M50 30h100v20H50zm0 40h120v15H50zm0 30h80v15H50zm0 30h100v15H50z' fill='%23cbd5e0'/%3E%3C/svg%3E" alt="Document placeholder" class="document-placeholder-img">
                        <div class="document-info-text">
                            <p class="document-filename">${doc.file_name}</p>
                            <p class="document-size">${formatFileSize(doc.file_size_bytes)}</p>
                            <p style="color: #666; margin: 8px 0 0 0; font-size: 13px;">Preview not available for this file type</p>
                            <a href="${fileUrl}" target="_blank" class="btn-primary" style="margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 8px 16px;">
                                <i class="fas fa-download"></i> Download & View
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading document content:', error);
        contentDiv.innerHTML = `
            <div class="error-preview">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading document preview</p>
                <div class="document-info-text">
                    <p class="document-filename">${doc.file_name}</p>
                    <p class="document-size">${formatFileSize(doc.file_size_bytes)}</p>
                </div>
            </div>
        `;
    }
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
            verified_by_insurance_company: isVerified,
            insurance_verification_notes: notes || null
        };

        if (isVerified) {
            updateData.insurance_verification_date = new Date().toISOString();
        } else {
            updateData.insurance_verification_date = null;
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

        // If a document is unverified, immediately clear the insurance company approval on the claim
        if (!isVerified && currentClaim) {
            try {
                const { error: claimClearErr } = await supabase
                    .from('claims')
                    .update({
                        is_approved_by_insurance_company: false,
                        // Clear approval date if present in schema; ignored if column doesn't exist
                        insurance_company_approval_date: null
                    })
                    .eq('id', currentClaim);
                if (claimClearErr) {
                    console.warn('Unable to clear insurance approval on claim after unverify:', claimClearErr);
                }
            } catch (e) {
                console.warn('Error clearing insurance approval on claim after unverify:', e);
            }
        }

        // Update current documents array
        const docIndex = currentDocuments.findIndex(doc => doc.id === documentId);
        if (docIndex !== -1) {
            currentDocuments[docIndex] = { ...currentDocuments[docIndex], ...updateData };
        }

        // Refresh displays
        const insuranceDocuments = currentDocuments.filter(doc => 
            INSURANCE_DOCUMENT_TYPES.includes(doc.type)
        );
        updateDocumentStats(currentDocuments, insuranceDocuments);
        displayInsuranceDocuments(insuranceDocuments);
        updateApprovalButtonStatus(insuranceDocuments);
        
        // Close modal
        closeDocumentViewer();

        // Show success message
        showSuccess(isVerified ? 'Document verified successfully!' : 'Document verification removed');

        // Reload claims to update counts
        setTimeout(() => {
            loadClaims();
        }, 1000);

    } catch (error) {
        console.error('Error saving verification:', error);
        showError('Failed to save verification status');
    }
}

function applyApprovedState() {
    const banner = document.getElementById('approvedBanner');
    const docsPage = document.getElementById('documentsPage');
    const actionsRow = document.getElementById('approvalActionsRow');
    if (currentClaimApproved) {
        if (banner) banner.style.display = '';
        if (docsPage) docsPage.classList.add('view-only');
        if (actionsRow) actionsRow.style.display = 'none';
        // Disable verification controls proactively
        const checkbox = document.getElementById('verifyCheckbox');
        const notes = document.getElementById('verificationNotes');
        const saveBtn = document.getElementById('saveVerification');
        if (checkbox) checkbox.disabled = true;
        if (notes) notes.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
    } else {
        if (banner) banner.style.display = 'none';
        if (docsPage) docsPage.classList.remove('view-only');
        if (actionsRow) actionsRow.style.display = '';
        const checkbox = document.getElementById('verifyCheckbox');
        const notes = document.getElementById('verificationNotes');
        const saveBtn = document.getElementById('saveVerification');
        if (checkbox) checkbox.disabled = false;
        if (notes) notes.disabled = false;
        if (saveBtn) saveBtn.disabled = false;
    }
}

function updateApprovalButtonStatus(insuranceDocuments) {
    const approveBtn = document.getElementById('approveClaimBtn');
    const approvalStatus = document.getElementById('approvalStatus');
    const approvalActionsRow = document.getElementById('approvalActionsRow');
    
    const allVerified = insuranceDocuments.length > 0 && 
        insuranceDocuments.every(doc => doc.verified_by_insurance_company);
    
    if (allVerified) {
        approveBtn.disabled = false;
        approveBtn.classList.add('ready');
        approvalStatus.innerHTML = `
            <div class="status-indicator ready">
                <i class="fas fa-check-circle"></i>
                <span>Ready for approval - All documents verified</span>
            </div>
        `;
    } else {
        approveBtn.disabled = true;
        approveBtn.classList.remove('ready');
        const pending = insuranceDocuments.filter(doc => !doc.verified_by_insurance_company).length;
        approvalStatus.innerHTML = `
            <div class="status-indicator">
                <i class="fas fa-clock"></i>
                <span>${pending} documents pending verification</span>
            </div>
        `;
    }
    
    // Show the action buttons when on documents page
    if (approvalActionsRow) {
        approvalActionsRow.style.display = 'flex';
    }
}

function showApprovalModal() {
    if (!currentClaim) return;
    
    // Get claim details for summary
    const claimSummary = document.getElementById('claimSummary');
    // Try to determine estimated cost from loaded claim data; fallback to dash
    let estimatedCostDisplay = '-';
    try {
        const claim = currentClaimData || {};
        const rawCost = claim.estimated_cost ?? claim.estimatedRepairCost ?? claim.estimated_repair_cost ?? claim.estimated_damage_cost ?? null;
        if (rawCost !== null && rawCost !== undefined && rawCost !== '') {
            estimatedCostDisplay = formatCurrency(rawCost);
        }
    } catch (e) {
        console.warn('Could not determine estimated cost for approval modal', e);
    }

    claimSummary.innerHTML = `
        <div class="summary-row">
            <div class="summary-label">Claim:</div>
            <div class="summary-value">${document.getElementById('claimTitle').textContent}</div>
        </div>
        <div class="summary-row">
            <div class="summary-label">Total Documents:</div>
            <div class="summary-value">${document.getElementById('totalDocs').textContent}</div>
        </div>
        <div class="summary-row">
            <div class="summary-label">Insurance Verified:</div>
            <div class="summary-value">${document.getElementById('insuranceVerifiedDocs').textContent}</div>
        </div>
        <div class="summary-row">
            <div class="summary-label">Car Company Verified:</div>
            <div class="summary-value">${document.getElementById('carVerifiedDocs').textContent}</div>
        </div>
        <div class="summary-row">
            <div class="summary-label">Estimated Cost:</div>
            <div class="summary-value">${estimatedCostDisplay}</div>
        </div>
    `;
    
    document.getElementById('approvalModal').style.display = 'flex';

    // Wire up validation for the inline cost input so approvers can't submit invalid values
    const confirmBtn = document.getElementById('confirmApproval');
    const costInputEl = document.getElementById('approvalEstimatedCostInput');
    function validateCostAndToggle() {
        if (!costInputEl) return;
        const raw = costInputEl.value.trim();
        if (raw === '') {
            // empty is allowed — treat as no change
            confirmBtn.disabled = false;
            return;
        }
        const parsed = parseCurrency(raw);
        if (Number.isNaN(parsed)) {
            confirmBtn.disabled = true;
            costInputEl.style.borderColor = 'rgba(255,0,0,0.6)';
        } else {
            confirmBtn.disabled = false;
            costInputEl.style.borderColor = '';
        }
    }

    if (costInputEl) {
        costInputEl.addEventListener('input', validateCostAndToggle);
        // initial validation
        setTimeout(validateCostAndToggle, 0);
    }
}

async function approveClaim() {
    if (!currentClaim) return;
    
    const notes = document.getElementById('approvalNotes').value.trim();
    
    try {
        const { error } = await supabase
            .from('claims')
            .update({
                is_successful: true,
                status: 'approved'
            })
            .eq('id', currentClaim);

        if (error) {
            console.error('Error approving claim:', error);
            showError('Failed to approve claim');
            return;
        }

        closeApprovalModal();
        showSuccess('Claim approved successfully!');
        
        // Return to claims page
        setTimeout(() => {
            showClaimsPage();
            loadClaims();
        }, 1500);

    } catch (error) {
        console.error('Error approving claim:', error);
        showError('Failed to approve claim');
    }
}

// Navigation functions
function showClaimsPage() {
    document.getElementById('claimsPage').classList.add('active');
    document.getElementById('documentsPage').classList.remove('active');
    currentClaim = null;
    currentClaimData = null;
    document.body.classList.remove('claim-view-active');
    
    // Hide the fixed action buttons when returning to claims page
    const approvalActionsRow = document.getElementById('approvalActionsRow');
    if (approvalActionsRow) {
        approvalActionsRow.style.display = 'none';
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

function closeApprovalModal() {
    document.getElementById('approvalModal').style.display = 'none';
    document.getElementById('approvalNotes').value = '';
}

// Filter functions
// Filter functions
function filterClaims() {
    const searchTerm = document.getElementById('claimsSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    
    const rows = document.querySelectorAll('.claim-row');
    
    rows.forEach(row => {
        const claimNumber = row.querySelector('td:first-child')?.textContent.toLowerCase() || '';
        const userName = row.querySelector('.user-name')?.textContent.toLowerCase() || '';
        const userEmail = row.querySelector('.user-info small')?.textContent.toLowerCase() || '';
        const status = row.querySelector('.status-badge')?.textContent.toLowerCase() || '';
        
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
    return status.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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

/**
 * Format a number as currency (Philippine Peso by default).
 * Accepts numbers or numeric strings. Falls back to a simple formatted value on error.
 */
function formatCurrency(value, locale = 'en-PH', currency = 'PHP') {
    if (value === null || value === undefined || value === '') return '-';
    const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]+/g, ''));
    if (Number.isNaN(num)) return String(value);
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(num);
}

function getDocumentIcon(type) {
    const icons = {
        'lto_or': 'fa-receipt',
        'lto_cr': 'fa-certificate',
        'drivers_license': 'fa-id-card',
        'owner_valid_id': 'fa-id-badge',
        'stencil_strips': 'fa-barcode',
        'damage_photos': 'fa-images',
        'job_estimate': 'fa-calculator',
        'police_report': 'fa-file-alt',
        'insurance_policy': 'fa-file-contract',
        'additional_documents': 'fa-paperclip'
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

function showError(message) {
    notify('error', 'Error', message);
}

function showSuccess(message) {
    notify('success', 'Success', message);
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const documentModal = document.getElementById('documentViewerModal');
    const approvalModal = document.getElementById('approvalModal');
    
    if (event.target === documentModal) {
        closeDocumentViewer();
    }
    if (event.target === approvalModal) {
        closeApprovalModal();
    }
});

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

