document.addEventListener('DOMContentLoaded', async function() {
    // Render dynamic clients in clients.html
    const clientGrid = document.querySelector('.client-grid.extended');
    if (clientGrid && typeof firebase !== 'undefined' && firebase.firestore) {
        let dynamicHtml = '';
        try {
            const snap = await firebase.firestore().collection('clients').orderBy('createdAt', 'desc').get();
            snap.forEach(doc => {
                const cl = doc.data();
                dynamicHtml += `<div class=\"client-card\" data-industry=\"${cl.category || ''}\">\n\
                    <div class=\"client-logo-box\">\n\
                        <div class=\"logo-placeholder\">\n\
                            <img width=\"100%\" src=\"${cl.imageUrl}\" alt=\"${cl.name}\">\n\
                        </div>\n\
                    </div>\n\
                    <h4>${cl.name}</h4>\n\
                    <p>${cl.location}</p>\n\
                </div>`;
            });
            if (dynamicHtml) {
                clientGrid.insertAdjacentHTML('beforeend', dynamicHtml);
            }
        } catch (err) {
            // Optionally show error
        }
    }

    // Filtering functionality (works for both static and dynamic)
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.getAttribute('data-filter');
            document.querySelectorAll('.client-card').forEach(card => {
                if (filter === 'all' || card.getAttribute('data-industry') === filter) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
});
