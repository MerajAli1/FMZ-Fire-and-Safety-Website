document.addEventListener('DOMContentLoaded', async function() {
    // Render equipment on index.html if section exists
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const equipmentSection = document.querySelector('#safety-equipment .container .row.g-4');
        if (equipmentSection) {
            equipmentSection.innerHTML = '<div class="text-center w-100 py-5"><div class="spinner-border text-primary"></div></div>';
            try {
                const snap = await firebase.firestore().collection('equipments').orderBy('createdAt', 'desc').limit(6).get();
                if (snap.empty) {
                    equipmentSection.innerHTML = '<p class="text-center w-100">No equipment added yet.</p>';
                } else {
                    let html = '';
                    snap.forEach(doc => {
                        const eq = doc.data();
                        html += `<div class=\"col-12 col-sm-6 col-md-4\">\n\
                            <div class=\"equipment-card\">\n\
                                <div class=\"card-image\">\n\
                                    <img src=\"${eq.imageUrl}\" alt=\"${eq.title}\" class=\"img-fluid rounded-3\">\n\
                                </div>\n\
                                <div class=\"card-content\">\n\
                                    <h3>${eq.title}</h3>\n\
                                    <p>${eq.description}</p>\n\
                                    <div class=\"equipment-meta\">\n\
                                        <span class=\"category\">${eq.category || ''}</span>\n\
                                    </div>\n\
                                </div>\n\
                            </div>\n\
                        </div>`;
                    });
                    equipmentSection.innerHTML = html;
                }
            } catch (err) {
                equipmentSection.innerHTML = '<p class="text-danger">Failed to load equipment.</p>';
            }
        }
    }

    // Client filtering
    const filterButtons = document.querySelectorAll('.filter-btn');
    const clientCards = document.querySelectorAll('.client-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            const industry = button.dataset.filter;

            clientCards.forEach(card => {
                if (industry === 'all' || card.dataset.industry === industry) {
                    card.style.display = '';
                    card.classList.add('fade-in');
                } else {
                    card.style.display = 'none';
                    card.classList.remove('fade-in');
                }
            });
        });
    });
});
