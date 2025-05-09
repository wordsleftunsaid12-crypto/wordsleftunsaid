import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const writeMessageBtn = document.getElementById('write-message-btn');
    const submissionForm = document.getElementById('submission-form');
    const closeFormBtn = document.getElementById('close-form');

    writeMessageBtn.addEventListener('click', () => {
        submissionForm.classList.remove('collapsed');
        submissionForm.scrollIntoView({ behavior: 'smooth' });
    });

    closeFormBtn.addEventListener('click', () => {
        submissionForm.classList.add('collapsed');
    });

    const successMessage = document.getElementById('success-message');

    submissionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const from = document.getElementById('from').value.trim();
        const to = document.getElementById('to').value.trim();
        const content = document.getElementById('content').value.trim();
        const email = document.getElementById('email').value.trim();

        if (!from || !to || !content) {
            alert('Please fill out all required fields.');
            return;
        }

        const submission = {
            from, 
            to, 
            content, 
            email, 
            approved: false
        };

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert([submission]);

            if (error) {
                console.error('Error inserting data:', error.message);
                alert('Failed to send message. Please try again.');
            } else {
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
    let targetMessageId = null; // Store the target message ID

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

    // Process hash and set target message ID
    function processHash() {
        const hash = window.location.hash;
        
        if (!hash) {
            targetMessageId = null;
            return false;
        }
        
        if (hash.startsWith('#message-')) {
            // Extract the message ID from the hash
            targetMessageId = hash.replace('#message-', '');
            
            // Check if the target message is already loaded
            const target = document.querySelector(hash);
            if (target) {
                // If already loaded, scroll to it
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightMessage(target);
                return true; // Found and processed
            }
            return false; // Not found yet
        }
        
        return false;
    }

    function highlightMessage(element) {
        element.classList.add('highlighted');
        setTimeout(() => {
            element.classList.remove('highlighted');
        }, 3000);
    }

    // Add hash change event listener
    window.addEventListener('hashchange', () => {
        const found = processHash();
        if (!found && targetMessageId) {
            // If hash changed to a new message ID and it's not found,
            // reset and reload all messages
            start = 0;
            noMoreMessages = false;
            messagesContainer.innerHTML = ''; // Clear existing messages
            fetchApprovedMessages();
        }
    });

    // Initial setup - check for hash on page load
    processHash();
    
    // Initial fetch
    fetchApprovedMessages();

    async function fetchApprovedMessages() {
        if (loadingMore || noMoreMessages) return;

        loadingMore = true;
        loading.style.display = 'block';

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
        document.querySelectorAll('.skeleton-card').forEach(el => el.remove());

        if (error) {
            console.error('Error fetching approved messages:', error.message);
            loading.textContent = 'Failed to load messages.';
            loadingMore = false;
            return;
        }

        if (data.length === 0) {
            noMoreMessages = true;
            loading.innerHTML = 'No more messages.';
            loadingMore = false;
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
        
        // Check if we need to scroll to a specific message after loading this batch
        if (targetMessageId) {
            const targetElement = document.querySelector(`#message-${targetMessageId}`);
            if (targetElement) {
                // Found the target message, scroll to it
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    highlightMessage(targetElement);
                }, 100); // Small delay to ensure animation works
            } else if (!noMoreMessages) {
                // If we didn't find the message and there are more to load, keep loading
                fetchApprovedMessages();
            }
        }
    }

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

    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
            fetchApprovedMessages();
        }
    });
});