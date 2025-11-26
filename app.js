// Application State
class SecretSantaApp {
    constructor() {
        // Initialize users data
        this.users = [
            { id: 1, name: "Наталья", password: "admin123", is_admin: true, wishlist: "" },
            { id: 2, name: "Наталия", password: "1234", is_admin: false, wishlist: "" },
            { id: 3, name: "Евгений", password: "1234", is_admin: false, wishlist: "" },
            { id: 4, name: "Андрей", password: "1234", is_admin: false, wishlist: "" },
            { id: 5, name: "Светлана", password: "1234", is_admin: false, wishlist: "" },
            { id: 6, name: "Эдуард", password: "1234", is_admin: false, wishlist: "" },
            { id: 7, name: "Виталий", password: "1234", is_admin: false, wishlist: "" },
            { id: 8, name: "Яна", password: "1234", is_admin: false, wishlist: "" },
            { id: 9, name: "Тамерлан", password: "1234", is_admin: false, wishlist: "" },
            { id: 10, name: "Ясмина", password: "1234", is_admin: false, wishlist: "" },
            { id: 11, name: "Александра", password: "1234", is_admin: false, wishlist: "" },
            { id: 12, name: "Галина", password: "1234", is_admin: false, wishlist: "" }
        ];

        this.currentUser = null;
        this.gameActive = false;
        this.pairs = []; // { santa_id, receiver_id }
        this.messages = []; // { id, sender_id, receiver_id, text, timestamp }
        this.recipientRevealed = false;

        this.init();
    }

    init() {
        this.createSnowflakes();
        this.populateUserSelect();
        this.setupEventListeners();
    }

    createSnowflakes() {
        const snowflakesContainer = document.getElementById('snowflakes');
        const snowflakeCount = 50;
        
        for (let i = 0; i < snowflakeCount; i++) {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake');
            snowflake.textContent = '❄';
            snowflake.style.left = Math.random() * 100 + '%';
            snowflake.style.animationDuration = (Math.random() * 3 + 2) + 's';
            snowflake.style.animationDelay = Math.random() * 5 + 's';
            snowflake.style.fontSize = (Math.random() * 0.5 + 0.5) + 'em';
            snowflakesContainer.appendChild(snowflake);
        }
    }

    populateUserSelect() {
        const select = document.getElementById('userSelect');
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            select.appendChild(option);
        });
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    handleLogin() {
        const userId = parseInt(document.getElementById('userSelect').value);
        const password = document.getElementById('passwordInput').value;

        if (!userId) {
            this.showToast('Выберите ваше имя!');
            return;
        }

        const user = this.users.find(u => u.id === userId);
        
        if (!user) {
            this.showToast('Пользователь не найден!');
            return;
        }

        if (user.password !== password) {
            this.showToast('Неверный пароль!');
            document.getElementById('passwordInput').value = '';
            return;
        }

        this.currentUser = user;
        this.showToast(`Добро пожаловать, ${user.name}!`);

        // Navigate to appropriate screen
        if (user.is_admin) {
            this.showAdminDashboard();
        } else {
            this.showUserDashboard();
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showAdminDashboard() {
        this.showScreen('adminScreen');
        this.updateAdminTable();
        this.updateGameStatus();
    }

    updateAdminTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        this.users.forEach((user, index) => {
            const row = document.createElement('tr');
            
            const wishlistPreview = user.wishlist ? 
                (user.wishlist.length > 30 ? user.wishlist.substring(0, 30) + '...' : user.wishlist) 
                : 'Не указано';

            const hasWishlist = user.wishlist ? 'filled' : 'empty';
            const statusText = user.wishlist ? '✓ Заполнен' : '⚠ Пусто';

            let recipientCell = '';
            if (this.gameActive) {
                const pair = this.pairs.find(p => p.santa_id === user.id);
                if (pair) {
                    const recipient = this.users.find(u => u.id === pair.receiver_id);
                    recipientCell = `<td>${recipient ? recipient.name : 'N/A'}</td>`;
                } else {
                    recipientCell = '<td>N/A</td>';
                }
            }

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.name}${user.is_admin ? ' 👑' : ''}</td>
                <td>${wishlistPreview}</td>
                <td><span class="status-badge ${hasWishlist}">${statusText}</span></td>
                ${this.gameActive ? recipientCell : ''}
            `;
            
            tbody.appendChild(row);
        });

        // Show/hide recipient column
        if (this.gameActive) {
            document.getElementById('recipientColumn').classList.remove('hidden');
        } else {
            document.getElementById('recipientColumn').classList.add('hidden');
        }
    }

    updateGameStatus() {
        const statusBadge = document.getElementById('gameStatusBadge');
        const drawButton = document.getElementById('drawButton');

        if (this.gameActive) {
            statusBadge.textContent = '✓ Активна';
            statusBadge.className = 'game-status active';
            drawButton.disabled = true;
        } else {
            statusBadge.textContent = '⏰ Ожидание';
            statusBadge.className = 'game-status waiting';
            drawButton.disabled = false;
        }
    }

    conductDraw() {
        // Check if all users have wishlists (optional, but good practice)
        const usersWithoutWishlist = this.users.filter(u => !u.wishlist && !u.is_admin);
        if (usersWithoutWishlist.length > 0) {
            this.showModal(
                '⚠ Предупреждение',
                `${usersWithoutWishlist.length} участник(ов) не заполнили wishlist. Продолжить?`,
                () => this.performDraw()
            );
            return;
        }

        this.performDraw();
    }

    performDraw() {
        // Fisher-Yates shuffle algorithm
        const userIds = this.users.map(u => u.id);
        let shuffled;
        let attempts = 0;
        const maxAttempts = 100;

        // Keep shuffling until no one is their own Santa
        do {
            shuffled = [...userIds];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            attempts++;
        } while (this.hasSelfAssignment(userIds, shuffled) && attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            this.showToast('Ошибка при распределении. Попробуйте еще раз.');
            return;
        }

        // Create pairs
        this.pairs = [];
        for (let i = 0; i < userIds.length; i++) {
            this.pairs.push({
                santa_id: userIds[i],
                receiver_id: shuffled[i]
            });
        }

        this.gameActive = true;
        this.showToast('🎉 Жеребьевка проведена успешно!');
        this.updateAdminTable();
        this.updateGameStatus();
    }

    hasSelfAssignment(original, shuffled) {
        for (let i = 0; i < original.length; i++) {
            if (original[i] === shuffled[i]) {
                return true;
            }
        }
        return false;
    }

    resetDraw() {
        this.showModal(
            '🔄 Подтверждение',
            'Вы уверены, что хотите сбросить жеребьевку? Все пары будут удалены.',
            () => {
                this.pairs = [];
                this.gameActive = false;
                this.messages = [];
                this.showToast('Жеребьевка сброшена');
                this.updateAdminTable();
                this.updateGameStatus();
            }
        );
    }

    showUserDashboard() {
        this.showScreen('userScreen');
        this.recipientRevealed = false;
        
        // Update greeting
        document.getElementById('userGreeting').textContent = `Привет, ${this.currentUser.name}! 🎄`;
        
        // Update wishlist
        document.getElementById('userWishlistInput').value = this.currentUser.wishlist || '';
        document.getElementById('savedWishlist').textContent = this.currentUser.wishlist || 'Пусто';
        
        // Update profile
        document.getElementById('profileName').textContent = this.currentUser.name;
        const profileStatus = document.getElementById('profileStatus');
        if (this.currentUser.wishlist) {
            profileStatus.innerHTML = '<strong style="color: var(--secondary-color);">✓ Wishlist заполнен</strong>';
            profileStatus.style.background = 'rgba(46, 204, 113, 0.2)';
            profileStatus.style.border = '1px solid var(--secondary-color)';
        } else {
            profileStatus.innerHTML = '<strong style="color: var(--primary-color);">⚠ Wishlist пуст</strong>';
            profileStatus.style.background = 'rgba(231, 76, 60, 0.2)';
            profileStatus.style.border = '1px solid var(--primary-color)';
        }
        
        // Update recipient section
        if (this.gameActive) {
            document.getElementById('recipientWaiting').classList.add('hidden');
            document.getElementById('recipientRevealed').classList.remove('hidden');
            document.getElementById('chatButtonContainer').style.display = 'block';
            
            // Reset gift box
            const giftBox = document.getElementById('revealGiftBox');
            giftBox.classList.remove('opened', 'opening');
            document.getElementById('recipientInfo').classList.add('hidden');
        } else {
            document.getElementById('recipientWaiting').classList.remove('hidden');
            document.getElementById('recipientRevealed').classList.add('hidden');
            document.getElementById('chatButtonContainer').style.display = 'none';
        }
    }

    saveWishlist() {
        const wishlistText = document.getElementById('userWishlistInput').value.trim();
        
        if (!wishlistText) {
            this.showToast('Введите ваши желания!');
            return;
        }

        this.currentUser.wishlist = wishlistText;
        
        // Update in users array
        const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) {
            this.users[userIndex].wishlist = wishlistText;
        }

        document.getElementById('savedWishlist').textContent = wishlistText;
        this.showToast('✓ Wishlist сохранен!');
        
        // Update profile status
        this.showUserDashboard();
    }

    revealRecipient() {
        if (this.recipientRevealed) return;
        
        const giftBox = document.getElementById('revealGiftBox');
        giftBox.classList.add('opening');
        
        setTimeout(() => {
            giftBox.classList.add('opened');
            
            setTimeout(() => {
                const pair = this.pairs.find(p => p.santa_id === this.currentUser.id);
                if (pair) {
                    const recipient = this.users.find(u => u.id === pair.receiver_id);
                    if (recipient) {
                        document.getElementById('recipientName').textContent = recipient.name;
                        document.getElementById('recipientWishlistText').textContent = 
                            recipient.wishlist || 'Не указано';
                        document.getElementById('recipientInfo').classList.remove('hidden');
                        this.recipientRevealed = true;
                    }
                }
            }, 500);
        }, 500);
    }

    openChat() {
        this.showScreen('chatScreen');
        this.loadChatMessages();
    }

    backToUserDashboard() {
        this.showUserDashboard();
    }

    loadChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        const pair = this.pairs.find(p => p.santa_id === this.currentUser.id);
        
        if (!pair) return;

        // Get messages between current user and their recipient
        const relevantMessages = this.messages.filter(m => 
            (m.sender_id === this.currentUser.id && m.receiver_id === pair.receiver_id) ||
            (m.sender_id === pair.receiver_id && m.receiver_id === this.currentUser.id)
        );

        if (relevantMessages.length === 0) {
            chatMessages.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                    <p>Чат с вашим подопечным</p>
                    <p style="font-size: 0.9em; margin-top: 10px;">Ваши сообщения будут показаны как "Тайный Санта"</p>
                </div>
            `;
            return;
        }

        chatMessages.innerHTML = '';
        relevantMessages.forEach(msg => {
            const isSent = msg.sender_id === this.currentUser.id;
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            
            const senderName = isSent ? 'Вы' : 'Тайный Санта';
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            messageDiv.innerHTML = `
                <div class="message-sender">${senderName}</div>
                <div class="message-bubble">
                    ${msg.text}
                    <div class="message-time">${time}</div>
                </div>
            `;
            
            chatMessages.appendChild(messageDiv);
        });

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        
        if (!text) return;

        const pair = this.pairs.find(p => p.santa_id === this.currentUser.id);
        if (!pair) {
            this.showToast('Ошибка: получатель не найден');
            return;
        }

        const message = {
            id: this.messages.length + 1,
            sender_id: this.currentUser.id,
            receiver_id: pair.receiver_id,
            text: text,
            timestamp: new Date().toISOString()
        };

        this.messages.push(message);
        input.value = '';
        this.loadChatMessages();
    }

    logout() {
        this.currentUser = null;
        this.recipientRevealed = false;
        document.getElementById('userSelect').value = '';
        document.getElementById('passwordInput').value = '';
        this.showScreen('loginScreen');
        this.showToast('Вы вышли из системы');
    }

    showToast(message) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showModal(title, message, onConfirm = null) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.classList.add('active');

        // Store callback for confirmation
        this.modalCallback = onConfirm;
    }

    closeModal() {
        const modal = document.getElementById('modal');
        modal.classList.remove('active');
        
        // Execute callback if exists
        if (this.modalCallback) {
            this.modalCallback();
            this.modalCallback = null;
        }
    }
}

// Initialize app
const app = new SecretSantaApp();

// Demo data for testing (optional)
function addDemoWishlists() {
    app.users[1].wishlist = "Книга по программированию, теплые носки, хороший чай";
    app.users[2].wishlist = "Настольная игра, шоколад, билеты в кино";
    app.users[3].wishlist = "Кружка с прикольным принтом, органайзер, растение";
    app.showToast('Демо-данные добавлены!');
    if (app.currentUser && app.currentUser.is_admin) {
        app.updateAdminTable();
    }
}

// Expose demo function for testing
window.addDemoWishlists = addDemoWishlists;