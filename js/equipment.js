document.addEventListener('DOMContentLoaded', function() {
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
