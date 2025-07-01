document.addEventListener('DOMContentLoaded', async function() {
    // Fetch and render equipment from Firestore
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const equipmentSection = document.querySelector('.equipment-section .container .row.g-4');
        if (equipmentSection) {
            equipmentSection.innerHTML = '<div class="text-center w-100 py-5"><div class="spinner-border text-primary"></div></div>';
            try {
                const snap = await firebase.firestore().collection('equipments').orderBy('createdAt', 'desc').get();
                if (snap.empty) {
                    equipmentSection.innerHTML = '<p class="text-center w-100">No equipment added yet.</p>';
                } else {
                    let html = '';
                    snap.forEach(doc => {
                        const eq = doc.data();
                        html += `<div class=\"col-12 col-sm-6 col-md-4\" data-category=\"${eq.category || ''}\">\n\
                            <div class=\"equipment-card\">\n\
                                <div class=\"card-image\">\n\
                                    <img src=\"${eq.imageUrl}\" alt=\"${eq.title}\" class=\"img-fluid rounded-3\">\n\
                                    <div class=\"hover-content\">\n\
                                        <a href=\"contact.html\" class=\"btn btn-outline-light\">Inquire Now</a>\n\
                                    </div>\n\
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

    // Equipment filtering
    const filterButtons = document.querySelectorAll('.filter-btn');
    const equipmentCards = document.querySelectorAll('[data-category]');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            const category = button.getAttribute('data-filter');

            equipmentCards.forEach(card => {
                if (category === 'all' || card.getAttribute('data-category') === category) {
                    card.style.display = '';
                    setTimeout(() => {
                        card.classList.add('fade-in');
                    }, 10);
                } else {
                    card.style.display = 'none';
                    card.classList.remove('fade-in');
                }
            });
        });
    });

    // Initialize all cards with fade-in
    equipmentCards.forEach(card => {
        card.classList.add('fade-in');
    });

    // Add inquiry link handling
    document.querySelectorAll('.hover-content .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const equipmentName = e.target.closest('.equipment-card').querySelector('h3').textContent;
            window.location.href = `contact.html?inquiry=${encodeURIComponent(equipmentName)}`;
        });
    });
});
