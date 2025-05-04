import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    // Form toggle functionality
    const writeMessageBtn = document.getElementById('write-message-btn');
    const submissionForm = document.getElementById('submission-form');
    const closeFormBtn = document.getElementById('close-form');
    
    // Open the form when "Write a message" button is clicked
    writeMessageBtn.addEventListener('click', () => {
        submissionForm.classList.remove('collapsed');
        // Scroll to the form
        submissionForm.scrollIntoView({ behavior: 'smooth' });
    });
    
    // Close the form when close button is clicked
    closeFormBtn.addEventListener('click', () => {
        submissionForm.classList.add('collapsed');
    });
    
    // Display success message properly
    const successMessage = document.getElementById('success-message');
    
    // Modified form submission handler
    submissionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Form field values
        const from = document.getElementById('from').value.trim();
        const to = document.getElementById('to').value.trim();
        const content = document.getElementById('content').value.trim();
        const email = document.getElementById('email').value.trim();

        // Ensure all fields are populated before submission
        if (!from || !to || !content) {
            alert('Please fill out all required fields.');
            return;
        }

        const submission = {
            from, 
            to, 
            content, 
            email, 
            approved: false // Assuming 'approved' is a required field for your data structure
        };

        try {
            const { data, error } = await supabase
                .from('messages') // Ensure 'messages' table exists
                .insert([submission]);

            if (error) {
                console.error('Error inserting data:', error.message);
                alert('Failed to send message. Please try again.');
            } else {
                // Reset the form and show success message
                submissionForm.reset();
                successMessage.textContent = '✅ Your message has been received and is pending review!';
                successMessage.style.display = 'block';
                setTimeout(() => {
                    successMessage.style.display = 'none';
                }, 5000);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred.');
        }

        // Hide the form after successful submission
        submissionForm.classList.add('collapsed');
    });

    const form = document.getElementById('submission-form');
    const messagesContainer = document.getElementById('messages-container');
    const loading = document.getElementById('loading');
    const backToTopButton = document.getElementById('back-to-top');

    let start = 0;
    const pageSize = 10;
    let loadingMore = false;
    let noMoreMessages = false;

    // Back to Top Button
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTopButton.style.display = 'block';
        } else {
            backToTopButton.style.display = 'none';
        }
    });

    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Fetch Initial Messages
    fetchApprovedMessages();

    async function fetchApprovedMessages() {
        if (loadingMore || noMoreMessages) return;

        loadingMore = true;
        loading.style.display = 'block';

        // Show Skeletons while loading
        for (let i = 0; i < 3; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            messagesContainer.appendChild(skeleton);
        }

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('approved', true)
            .order('created_at', { ascending: false })
            .range(start, start + pageSize - 1);

        loading.style.display = 'none';

        // Remove Skeletons
        document.querySelectorAll('.skeleton-card').forEach(el => el.remove());

        if (error) {
            console.error('Error fetching approved messages:', error.message);
            loading.textContent = 'Failed to load messages.';
            return;
        }

        if (data.length === 0) {
            noMoreMessages = true;
            loading.innerHTML = 'No more messages.';
            return;
        }

        data.forEach(message => {
            const messageCard = document.createElement('div');
            messageCard.className = 'message-card';
            messageCard.id = `message-${message.id}`;
            messageCard.innerHTML = `
                <h3>From <span class="name">${message.from}</span> to <span class="name">${message.to}</span>:</h3>
                <p>${message.content}</p>
            `;
            messagesContainer.appendChild(messageCard);
        });

        observeMessages();

        start += pageSize;
        loadingMore = false;
    }

    // Observe Messages for Scroll Animations
    function observeMessages() {
        const cards = document.querySelectorAll('.message-card:not(.observed)');

        const observer = new IntersectionObserver(entries => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('show');
                        entry.target.classList.add('observed');
                    }, index * 150);
                }
            });
        }, {
            threshold: 0.1
        });

        cards.forEach(card => {
            observer.observe(card);
        });
    }

    // Infinite Scroll Loading
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
            fetchApprovedMessages();
        }
    });
});
