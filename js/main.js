document.addEventListener('DOMContentLoaded', function() {
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
