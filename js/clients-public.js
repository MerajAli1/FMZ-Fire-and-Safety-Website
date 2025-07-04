document.addEventListener('DOMContentLoaded', async function() {
    // Render dynamic clients in index.html
    const clientGrid = document.querySelector('.client-grid');
    if (clientGrid && typeof firebase !== 'undefined' && firebase.firestore) {
        // Insert dynamic clients after hardcoded ones
        let dynamicHtml = '';
        try {
            const snap = await firebase.firestore().collection('clients').orderBy('createdAt', 'desc').limit(8).get();
            snap.forEach(doc => {
                const cl = doc.data();
                dynamicHtml += `<div class="client-card" data-industry="${cl.category || ''}">
                    <div class="client-logo-box">
                        <div class="logo-placeholder">
                            <img width="100%" src="${cl.imageUrl}" alt="${cl.name}">
                        </div>
                    </div>
                    <h4>${cl.name}</h4>
                    <p>${cl.location}</p>
                </div>`;
            });
            if (dynamicHtml) {
                clientGrid.insertAdjacentHTML('beforeend', dynamicHtml);
            }
        } catch (err) {
            // Optionally show error
        }
    }
});
