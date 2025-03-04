document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Get Firestore instance
        const db = firebase.firestore();

        // Configure cache settings
        db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
            merge: true
        });

        const submissionsTable = document.getElementById('submissionsTable');
        const loader = document.getElementById('loader');
        const searchInput = document.getElementById('searchInput');

        // Show loader
        function showLoader() {
            loader.style.display = 'block';
        }

        // Hide loader
        function hideLoader() {
            loader.style.display = 'none';
        }

        // Format date
        function formatDate(timestamp) {
            return new Date(timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Load submissions
        async function loadSubmissions() {
            showLoader();
            try {
                const snapshot = await db.collection('contacts')
                    .orderBy('timestamp', 'desc')
                    .get();

                submissionsTable.innerHTML = '';
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${formatDate(data.timestamp)}</td>
                        <td>${data.name}</td>
                        <td>${data.email}</td>
                        <td>${data.phone}</td>
                        <td>${data.subject}</td>
                        <td><span class="status-badge status-${data.status || 'new'}">${data.status || 'new'}</span></td>
                        <td>
                            <button onclick="viewSubmission('${doc.id}')" class="btn btn-sm btn-primary action-btn">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="updateStatus('${doc.id}', '${data.status}')" class="btn btn-sm btn-success action-btn">
                                <i class="fas fa-check"></i>
                            </button>
                            <button onclick="deleteSubmission('${doc.id}')" class="btn btn-sm btn-danger action-btn">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    submissionsTable.appendChild(row);
                });
            } catch (error) {
                console.error('Error loading submissions:', error);
                Swal.fire('Error', 'Failed to load submissions', 'error');
            }
            hideLoader();
        }

        // View submission details
        window.viewSubmission = function(id) {
            db.collection('contacts').doc(id).get()
                .then(doc => {
                    const data = doc.data();
                    Swal.fire({
                        title: 'Submission Details',
                        html: `
                            <div class="text-start">
                                <p><strong>Name:</strong> ${data.name}</p>
                                <p><strong>Email:</strong> ${data.email}</p>
                                <p><strong>Phone:</strong> ${data.phone}</p>
                                <p><strong>Subject:</strong> ${data.subject}</p>
                                <p><strong>Message:</strong></p>
                                <p>${data.message}</p>
                                <p><strong>Date:</strong> ${formatDate(data.timestamp)}</p>
                            </div>
                        `,
                        width: '600px'
                    });
                });
        };

        // Update submission status
        window.updateStatus = function(id, currentStatus) {
            const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
            
            db.collection('contacts').doc(id).update({
                status: newStatus
            })
            .then(() => {
                loadSubmissions();
                Swal.fire('Success', 'Status updated successfully', 'success');
            })
            .catch(error => {
                console.error('Error updating status:', error);
                Swal.fire('Error', 'Failed to update status', 'error');
            });
        };

        // Delete submission
        window.deleteSubmission = function(id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "This action cannot be undone!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    db.collection('contacts').doc(id).delete()
                        .then(() => {
                            loadSubmissions();
                            Swal.fire('Deleted!', 'Submission has been deleted.', 'success');
                        })
                        .catch(error => {
                            console.error('Error deleting submission:', error);
                            Swal.fire('Error', 'Failed to delete submission', 'error');
                        });
                }
            });
        };

        // Search functionality
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const rows = submissionsTable.getElementsByTagName('tr');
            
            Array.from(rows).forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });

        // Initial load
        loadSubmissions();

    } catch (error) {
        console.error('Firebase initialization error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to initialize Firebase. Please check your configuration.'
        });
    }
});
