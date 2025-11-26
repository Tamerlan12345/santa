import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Connection
const SUPABASE_URL = 'https://amtmwdqroekyygpmlluw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdG13ZHFyb2VreXlncG1sbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDA0OTIsImV4cCI6MjA3NTYxNjQ5Mn0.HrtBBzMrLtZBnzLeePpefvGYK7p0XZMusloKTz3EPw0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
class SecretSantaApp {
    constructor() {
        this.users = []; // Will be fetched from Supabase
        this.currentUser = null;
        this.selectedUserId = null; // New property to track selected user
        this.gameActive = false;
        this.pairs = [];
        this.messages = [];
        this.recipientRevealed = false;

        this.init();
    }

    async init() {
        this.createSnowflakes();
        await this.populateUserGrid();
        this.setupEventListeners();
        this.listenForGameChanges();
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

    async populateUserGrid() {
        const grid = document.getElementById('userGrid');
        grid.innerHTML = ''; // Clear existing grid

        const { data, error } = await supabase.from('users').select('*').order('name');

        if (error) {
            console.error('Error fetching users:', error);
            this.showToast('Ошибка загрузки пользователей');
            return;
        }

        this.users = data; // Cache users locally

        this.users.forEach(user => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'user-btn';
            button.textContent = user.name;
            button.dataset.userId = user.id;

            button.addEventListener('click', () => {
                this.selectedUserId = user.id;

                // Update visual state
                document.querySelectorAll('.user-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Focus password field
                const passwordInput = document.getElementById('passwordInput');
                passwordInput.value = '';
                passwordInput.focus();
            });

            grid.appendChild(button);
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

    async handleLogin() {
        if (!this.selectedUserId) {
            this.showToast('Выберите ваше имя!');
            return;
        }
        
        const password = document.getElementById('passwordInput').value;
        if (!password) {
            this.showToast('Введите пароль!');
            return;
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', this.selectedUserId)
            .single();

        if (error || !user) {
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

        // Fetch game state and navigate
        await this.fetchInitialData();

        if (user.is_admin) {
            this.showAdminDashboard();
        } else {
            this.showUserDashboard();
        }
    }

    async fetchInitialData() {
        // Fetch game status
        const { data: gameStatus, error: gameError } = await supabase
            .from('game_settings')
            .select('value')
            .eq('key', 'game_active')
            .single();

        if (gameError) console.error('Error fetching game status:', gameError);
        else this.gameActive = gameStatus.value === 'true';

        // If game is active, fetch pairs
        if (this.gameActive) {
            const { data: pairs, error: pairsError } = await supabase
                .from('pairs')
                .select('*');

            if (pairsError) console.error('Error fetching pairs:', pairsError);
            else this.pairs = pairs;
        } else {
            this.pairs = [];
        }

        // Always fetch all users for admin table and recipient info
        const { data: users, error: usersError } = await supabase.from('users').select('*');
        if (usersError) console.error('Error fetching all users:', usersError);
        else this.users = users;
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

    async conductDraw() {
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

    async performDraw() {
        const userIds = this.users.map(u => u.id);
        let shuffled;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            shuffled = [...userIds].sort(() => Math.random() - 0.5);
            attempts++;
        } while (this.hasSelfAssignment(userIds, shuffled) && attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            this.showToast('Ошибка при распределении. Попробуйте еще раз.');
            return;
        }

        const newPairs = userIds.map((id, index) => ({
            santa_id: id,
            receiver_id: shuffled[index]
        }));

        // Insert new pairs
        const { error: insertError } = await supabase.from('pairs').insert(newPairs);
        if (insertError) {
            this.showToast('Ошибка сохранения пар.');
            console.error('Error inserting pairs:', insertError);
            return;
        }

        // Update game status
        const { error: updateError } = await supabase
            .from('game_settings')
            .update({ value: 'true' })
            .eq('key', 'game_active');

        if (updateError) {
            this.showToast('Ошибка обновления статуса игры.');
            console.error('Error updating game status:', updateError);
            return;
        }

        this.pairs = newPairs;
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

    async resetDraw() {
        this.showModal(
            '🔄 Подтверждение',
            'Вы уверены, что хотите сбросить жеребьевку? Все пары и сообщения будут удалены.',
            async () => {
                // Delete all pairs
                const { error: pairsError } = await supabase.from('pairs').delete().gt('id', 0);
                if (pairsError) {
                    this.showToast('Ошибка удаления пар.');
                    console.error('Error deleting pairs:', pairsError);
                    return;
                }

                // Delete all messages
                const { error: messagesError } = await supabase.from('messages').delete().gt('id', 0);
                 if (messagesError) {
                    this.showToast('Ошибка удаления сообщений.');
                    console.error('Error deleting messages:', messagesError);
                    return;
                }

                // Update game status
                const { error: updateError } = await supabase
                    .from('game_settings')
                    .update({ value: 'false' })
                    .eq('key', 'game_active');

                if (updateError) {
                    this.showToast('Ошибка обновления статуса.');
                     console.error('Error updating game status:', updateError);
                    return;
                }

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

    async saveWishlist() {
        const wishlistText = document.getElementById('userWishlistInput').value.trim();
        
        if (!wishlistText) {
            this.showToast('Введите ваши желания!');
            return;
        }

        const { error } = await supabase
            .from('users')
            .update({ wishlist: wishlistText })
            .eq('id', this.currentUser.id);

        if (error) {
            this.showToast('Ошибка сохранения. Попробуйте снова.');
            console.error('Error saving wishlist:', error);
            return;
        }

        this.currentUser.wishlist = wishlistText;
        
        // Update local cache
        const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) this.users[userIndex].wishlist = wishlistText;

        document.getElementById('savedWishlist').textContent = wishlistText;
        this.showToast('✓ Wishlist сохранен!');
        
        // Update profile status visually
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

    async openChat() {
        this.showScreen('chatScreen');
        await this.loadChatMessages();
        this.subscribeToChat();
    }

    backToUserDashboard() {
        this.unsubscribeFromChat();
        this.showUserDashboard();
    }

    async loadChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        const pair = this.pairs.find(p => p.santa_id === this.currentUser.id);
        if (!pair) return;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`(sender_id.eq.${this.currentUser.id},receiver_id.eq.${pair.receiver_id}),(sender_id.eq.${pair.receiver_id},receiver_id.eq.${this.currentUser.id})`)
            .order('created_at');

        if (error) {
            console.error('Error loading messages:', error);
            return;
        }

        this.messages = data;

        if (this.messages.length === 0) {
            chatMessages.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                    <p>Чат с вашим подопечным</p>
                    <p style="font-size: 0.9em; margin-top: 10px;">Ваши сообщения будут показаны как "Тайный Санта"</p>
                </div>
            `;
            return;
        }

        chatMessages.innerHTML = '';
        this.messages.forEach(msg => this.renderMessage(msg));
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        const pair = this.pairs.find(p => p.santa_id === this.currentUser.id);
        if (!pair) {
            this.showToast('Ошибка: получатель не найден');
            return;
        }

        const message = {
            sender_id: this.currentUser.id,
            receiver_id: pair.receiver_id,
            text: text,
        };

        const { error } = await supabase.from('messages').insert(message);

        if (error) {
            this.showToast('Ошибка отправки сообщения.');
            console.error('Error sending message:', error);
            return;
        }

        input.value = '';
        // Realtime will handle rendering the new message
    }

    logout() {
        this.currentUser = null;
        this.selectedUserId = null;
        this.recipientRevealed = false;
        this.unsubscribeFromChat(); // Ensure subscription is cleaned up

        // Reset UI
        document.querySelectorAll('.user-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('passwordInput').value = '';

        this.showScreen('loginScreen');
        this.showToast('Вы вышли из системы');
    }

    renderMessage(msg) {
        const chatMessages = document.getElementById('chatMessages');
        // Clear initial message if it exists
        if (chatMessages.querySelector('div[style*="text-align: center"]')) {
            chatMessages.innerHTML = '';
        }

        const isSent = msg.sender_id === this.currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

        const senderName = isSent ? 'Вы' : 'Тайный Санта';
        const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', {
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    subscribeToChat() {
        if (this.chatSubscription) return; // Already subscribed

        const pair = this.pairs.find(p => p.santa_id === this.currentUser.id);
        if (!pair) return;

        const channelId = `chat-${Math.min(this.currentUser.id, pair.receiver_id)}-${Math.max(this.currentUser.id, pair.receiver_id)}`;

        this.chatSubscription = supabase
            .channel(channelId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, payload => {
                // Check if the message belongs to this chat
                const msg = payload.new;
                const isSender = msg.sender_id === this.currentUser.id && msg.receiver_id === pair.receiver_id;
                const isReceiver = msg.receiver_id === this.currentUser.id && msg.sender_id === pair.receiver_id;

                if (isSender || isReceiver) {
                    this.renderMessage(msg);
                }
            })
            .subscribe();
    }

    unsubscribeFromChat() {
        if (this.chatSubscription) {
            supabase.removeChannel(this.chatSubscription);
            this.chatSubscription = null;
        }
    }

    listenForGameChanges() {
        this.gameSubscription = supabase
            .channel('game-settings-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'game_settings',
                filter: 'key=eq.game_active'
            }, payload => {
                const newStatus = payload.new.value === 'true';
                if (this.gameActive !== newStatus) {
                    this.showToast('Статус игры изменился! Перезагрузка...');
                    setTimeout(() => window.location.reload(), 2000);
                }
            })
            .subscribe();
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
