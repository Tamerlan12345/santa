// ==========================================
// КОНФИГУРАЦИЯ SUPABASE
// ==========================================
// Вставьте сюда свои реальные данные из настроек проекта Supabase
const supabaseUrl = 'https://amtmwdqroekyygpmlluw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdG13ZHFyb2VreXlncG1sbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDA0OTIsImV4cCI6MjA3NTYxNjQ5Mn0.HrtBBzMrLtZBnzLeePpefvGYK7p0XZMusloKTz3EPw0';

// Инициализация клиента
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// ОСНОВНОЙ КЛАСС ПРИЛОЖЕНИЯ
// ==========================================
class SecretSantaApp {
    constructor() {
        this.currentUser = null;
        this.gameActive = false;
        this.users = [];
        this.pairs = [];
        this.selectedUserId = null;

        this.chatMode = 'recipient'; // 'recipient' (я дарю) или 'santa' (мне дарят)

        // Подписки на Realtime
        this.subscriptions = [];

        this.init();
    }

    async init() {
        this.createSnowflakes();
        await this.loadInitialData();
        this.setupEventListeners();
        this.setupRealtimeSubscription();

        // НОВОЕ: Загружаем уведомления для главного экрана
        await this.loadPublicNotifications();
    }

    // --- Инициализация и загрузка данных ---

    async loadInitialData() {
        // 1. Загружаем настройки игры
        const { data: settings } = await supabase
            .from('game_settings')
            .select('*')
            .eq('key', 'game_active')
            .single();
        
        if (settings) this.gameActive = settings.value === 'true';

        // 2. Загружаем пользователей
        await this.fetchUsers();
    }

    async fetchUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('name');

        if (error) {
            console.error('Ошибка загрузки пользователей:', error);
            return;
        }

        this.users = data;

        // Если мы на экране логина, перерисовываем кнопки
        if (document.getElementById('loginScreen').classList.contains('active')) {
            this.renderUserButtons();
        }
    }

    // --- Интерфейс входа (Кнопки) ---

    renderUserButtons() {
        const grid = document.getElementById('userGrid');
        if (!grid) return; // Защита, если HTML не обновлен

        grid.innerHTML = '';

        this.users.forEach(user => {
            const btn = document.createElement('div');
            btn.className = 'user-btn';
            btn.textContent = user.name;
            btn.onclick = () => this.selectUser(user.id, btn);
            grid.appendChild(btn);
        });
    }

    selectUser(userId, btnElement) {
        document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        this.selectedUserId = userId;

        const passInput = document.getElementById('passwordInput');
        passInput.value = '';
        passInput.focus();
    }

    async handleLogin() {
        if (!this.selectedUserId) {
            this.showToast('Выберите ваше имя!');
            return;
        }

        const password = document.getElementById('passwordInput').value;

        // Проверка пароля через БД
        const user = this.users.find(u => u.id === this.selectedUserId);

        if (!user || user.password !== password) {
            this.showToast('Неверный пароль!');
            document.getElementById('passwordInput').value = '';
            return;
        }

        this.currentUser = user;
        this.showToast(`Добро пожаловать, ${user.name}!`);

        // Загружаем пары, если игра активна
        if (this.gameActive) {
            await this.fetchPairs();
        }

        this.showUserDashboard();
    }

    // --- НОВОЕ: Метод загрузки уведомлений ---
    async loadPublicNotifications() {
        const listContainer = document.getElementById('publicNotificationsList');
        if (!listContainer) return;

        // Забираем последние 15 сообщений
        const { data: messages, error } = await supabase
            .from('messages')
            .select('receiver_id, created_at')
            .order('created_at', { ascending: false })
            .limit(15);

        if (error) {
            console.error('Ошибка загрузки уведомлений:', error);
            listContainer.innerHTML = '<div style="text-align:center;">Тишина...</div>';
            return;
        }

        this.renderNotificationsList(messages);
    }

    renderNotificationsList(messages) {
        const listContainer = document.getElementById('publicNotificationsList');
        if (!listContainer) return;

        listContainer.innerHTML = ''; // Clear it first

        if (!messages || messages.length === 0) {
            listContainer.innerHTML = '<div class="placeholder" style="text-align:center; color: #bdc3c7;">Пока сообщений нет ❄️</div>';
            return;
        }

        messages.forEach(msg => {
            this.renderSingleNotification(msg, false); // append
        });
    }

    renderSingleNotification(msg, prepend = false) {
        const listContainer = document.getElementById('publicNotificationsList');
        if (!listContainer) return;

        // Remove placeholder if it exists
        const placeholder = listContainer.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        const recipient = this.users.find(u => u.id === msg.receiver_id);
        const recipientName = recipient ? recipient.name : 'Участнику';

        const date = new Date(msg.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = 'notif-item';
        div.innerHTML = `
            <span class="notif-time">${timeStr}</span>
            <span class="notif-text"><b>${recipientName}</b>, вам написал Тайный Санта!</span>
        `;

        if (prepend) {
            listContainer.prepend(div);
        } else {
            listContainer.appendChild(div);
        }

        // Enforce max of 15 items
        while (listContainer.children.length > 15) {
            listContainer.lastElementChild.remove();
        }
    }
    // --- Логика Администратора ---

    showAdminDashboard() {
        this.showScreen('adminScreen');
        this.updateAdminTable();
        this.updateGameStatusUI();

        // Admin's own wishlist
        const adminUser = this.users.find(u => u.is_admin);
        if (adminUser) {
            document.getElementById('adminWishlistInput').value = adminUser.wishlist || '';
        }

        // Admin's recipient info
        if (this.gameActive) {
            const adminPair = this.pairs.find(p => p.santa_id === adminUser.id);
            if (adminPair) {
                const recipient = this.users.find(u => u.id === adminPair.receiver_id);
                if (recipient) {
                    document.getElementById('adminRecipientName').textContent = recipient.name;
                    document.getElementById('adminRecipientWishlistText').textContent = recipient.wishlist || 'Не указано';
                    document.getElementById('adminRecipientInfo').classList.remove('hidden');
                    document.getElementById('adminRecipientWaiting').classList.add('hidden');
                }
            }
        } else {
            document.getElementById('adminRecipientInfo').classList.add('hidden');
            document.getElementById('adminRecipientWaiting').classList.remove('hidden');
        }
    }

    async updateAdminTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        // Актуализируем данные перед рендером
        await this.fetchPairs();

        this.users.forEach((user, index) => {
            const row = document.createElement('tr');
            
            const wishlistPreview = user.wishlist ? 
                (user.wishlist.length > 30 ? user.wishlist.substring(0, 30) + '...' : user.wishlist) 
                : 'Не указано';

            const hasWishlist = user.wishlist ? 'filled' : 'empty';
            const statusText = user.wishlist ? '✓ Заполнен' : '⚠ Пусто';

            let recipientCell = '<td>N/A</td>';
            if (this.gameActive) {
                const pair = this.pairs.find(p => p.santa_id === user.id);
                if (pair) {
                    const recipient = this.users.find(u => u.id === pair.receiver_id);
                    recipientCell = `<td>${recipient ? recipient.name : '???'}</td>`;
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

        const recColumn = document.getElementById('recipientColumn');
        if (this.gameActive) recColumn.classList.remove('hidden');
        else recColumn.classList.add('hidden');
    }

    async conductDraw() {
        // Простая проверка
        const emptyWishlists = this.users.filter(u => !u.wishlist && !u.is_admin).length;
        if (emptyWishlists > 0) {
            if(!confirm(`${emptyWishlists} чел. без вишлиста. Продолжить?`)) return;
        }

        // Алгоритм перемешивания (Fisher-Yates)
        const userIds = this.users.map(u => u.id);
        let shuffled;
        let valid = false;

        // Пытаемся найти комбинацию, где никто не дарит сам себе
        for(let attempt=0; attempt<100; attempt++) {
            shuffled = [...userIds];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            if (!userIds.some((id, idx) => id === shuffled[idx])) {
                valid = true;
                break;
            }
        }

        if (!valid) {
            this.showToast('Ошибка алгоритма. Попробуйте снова.');
            return;
        }

        // Подготовка данных для вставки
        const newPairs = userIds.map((santaId, idx) => ({
            santa_id: santaId,
            receiver_id: shuffled[idx]
        }));

        // Транзакция: Очистка старых пар -> Вставка новых -> Обновление статуса
        try {
            await supabase.from('pairs').delete().neq('id', 0); // Удалить все
            await supabase.from('pairs').insert(newPairs);
            await supabase.from('game_settings')
                .update({ value: 'true' })
                .eq('key', 'game_active');

            this.showToast('🎉 Жеребьевка завершена!');
        } catch (e) {
            console.error(e);
            this.showToast('Ошибка при сохранении в БД');
        }
    }

    async resetDraw() {
        if(!confirm('Сбросить игру? Все пары удалятся.')) return;

        await supabase.from('pairs').delete().neq('id', 0);
        await supabase.from('game_settings')
            .update({ value: 'false' })
            .eq('key', 'game_active');

        this.showToast('Игра сброшена.');
    }

    async saveAdminWishlist() {
        const text = document.getElementById('adminWishlistInput').value.trim();
        const adminUser = this.users.find(u => u.is_admin);
        if (!text || !adminUser) return;

        const { error } = await supabase
            .from('users')
            .update({ wishlist: text })
            .eq('id', adminUser.id);

        if (!error) {
            this.showToast('Wishlist администратора сохранен!');
        }
    }

    openAdminChat() {
        // Админ всегда открывает чат как Санта (пишет получателю)
        this.openChat('recipient');
    }

    // --- Логика Пользователя ---

    showUserDashboard() {
        this.showScreen('userScreen');
        document.getElementById('userGreeting').textContent = `Привет, ${this.currentUser.name}! 🎄`;

        const adminBtn = document.getElementById('adminDashboardBtn');
        if (this.currentUser.is_admin) {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }
        
        // Wishlist
        document.getElementById('userWishlistInput').value = this.currentUser.wishlist || '';
        document.getElementById('savedWishlist').textContent = this.currentUser.wishlist || 'Пусто';
        
        this.updateProfileStatusUI();
        this.updateRecipientUI();
    }

    async saveWishlist() {
        const text = document.getElementById('userWishlistInput').value.trim();
        if (!text) return;

        const { error } = await supabase
            .from('users')
            .update({ wishlist: text })
            .eq('id', this.currentUser.id);

        if (!error) {
            this.currentUser.wishlist = text;
            this.showUserDashboard(); // Обновить UI
            this.showToast('Сохранено!');
        }
    }

    async updateRecipientUI() {
        if (!this.gameActive) {
            document.getElementById('recipientWaiting').classList.remove('hidden');
            document.getElementById('recipientRevealed').classList.add('hidden');
            document.getElementById('chatButtonContainer').style.display = 'none';
            return;
        }

        // Если игра активна, ищем пару
        await this.fetchPairs();
        const myPair = this.pairs.find(p => p.santa_id === this.currentUser.id);

        document.getElementById('recipientWaiting').classList.add('hidden');
        document.getElementById('recipientRevealed').classList.remove('hidden');
        document.getElementById('chatButtonContainer').style.display = 'flex';

        // Сброс состояния коробки при входе
        const giftBox = document.getElementById('revealGiftBox');
        giftBox.classList.remove('opened', 'opening');
        document.getElementById('recipientInfo').classList.add('hidden');

        // Логика "показать", если коробка будет открыта
        this.currentRecipient = this.users.find(u => u.id === myPair.receiver_id);
    }

    revealRecipient() {
        const giftBox = document.getElementById('revealGiftBox');
        giftBox.classList.add('opening');
        
        setTimeout(() => {
            giftBox.classList.add('opened');
            setTimeout(() => {
                if (this.currentRecipient) {
                    document.getElementById('recipientName').textContent = this.currentRecipient.name;
                    document.getElementById('recipientWishlistText').textContent =
                        this.currentRecipient.wishlist || 'Не указано';
                    document.getElementById('recipientInfo').classList.remove('hidden');
                }
            }, 500);
        }, 500);
    }

    // --- Чат ---

    async openChat(mode) {
        this.chatMode = mode; // Запоминаем режим
        this.showScreen('chatScreen');

        // Меняем заголовок чата для ясности
        const headerTitle = document.querySelector('.chat-header h2');
        const headerSubtitle = document.querySelector('#chatMessages p'); // Текст-подсказка внутри чата

        if (this.chatMode === 'recipient') {
            headerTitle.textContent = '🎁 Чат с Подопечным';
            if(headerSubtitle) headerSubtitle.textContent = 'Вы — Тайный Санта. Не раскрывайте себя!';
        } else {
            headerTitle.textContent = '🎅 Чат с Сантой';
            if(headerSubtitle) headerSubtitle.textContent = 'Здесь можно намекнуть Санте, что вы хотите.';
        }

        await this.loadChatMessages();
    }

    async loadChatMessages() {
        // Получаем обе пары, где участвует текущий пользователь
        const myPair = this.pairs.find(p => p.santa_id === this.currentUser.id);     // Я дарю
        const santaPair = this.pairs.find(p => p.receiver_id === this.currentUser.id); // Мне дарят

        let partnerId = null;

        // Определяем ID собеседника в зависимости от режима
        if (this.chatMode === 'recipient') {
            // Режим: Я пишу тому, кому дарю
            if (myPair) partnerId = myPair.receiver_id;
        } else {
            // Режим: Я пишу своему Санте
            if (santaPair) partnerId = santaPair.santa_id;
        }

        if (!partnerId) {
            console.log("Партнер не найден для режима:", this.chatMode);
            // Если партнеров нет (еще нет жеребьевки или ошибка), просто не грузим сообщения
            const container = document.getElementById('chatMessages');
            container.innerHTML = '';
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.marginTop = '20px';
            empty.textContent = 'Чат недоступен.';
            container.appendChild(empty);
            return;
        }

        // Загружаем сообщения
        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`)
            .order('created_at', { ascending: true });

        // Фильтруем сообщения только с выбранным партнером
        const relevant = data.filter(m =>
            (m.sender_id === this.currentUser.id && m.receiver_id === partnerId) ||
            (m.sender_id === partnerId && m.receiver_id === this.currentUser.id)
        );

        this.renderMessages(relevant);
    }

    renderMessages(messages) {
        const container = document.getElementById('chatMessages');
        // Очищаем, но сохраняем заголовок-подсказку, если хотим (или просто перерисовываем всё)
        container.innerHTML = '';

        // Добавляем подсказку заново
        const tip = document.createElement('div');
        tip.style.textAlign = 'center';
        tip.style.color = '#bdc3c7';
        tip.style.padding = '20px';
        tip.innerHTML = this.chatMode === 'recipient'
            ? '<p>Чат с вашим подопечным. Вы — Санта.</p>'
            : '<p>Чат с вашим Сантой. Он увидит это сообщение.</p>';
        container.appendChild(tip);

        if (!messages || messages.length === 0) {
            const empty = document.createElement('div');
            empty.style.textAlign = 'center';
            empty.style.marginTop = '20px';
            empty.textContent = 'Сообщений пока нет...';
            container.appendChild(empty);
            return;
        }

        messages.forEach(msg => {
            const isSent = msg.sender_id === this.currentUser.id;
            const div = document.createElement('div');
            div.className = `message ${isSent ? 'sent' : 'received'}`;

            // Логика имен:
            // Если isSent (это я): Я всегда "Вы".
            // Если !isSent (собеседник):
            //    - В режиме 'recipient' собеседник — это "Подопечный".
            //    - В режиме 'santa' собеседник — это "Тайный Санта".

            let senderName = 'Вы';
            if (!isSent) {
                senderName = this.chatMode === 'recipient' ? 'Подопечный' : 'Тайный Санта';
            }

            const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            div.innerHTML = `
                <div class="message-sender">${senderName}</div>
                <div class="message-bubble">
                    ${msg.text}
                    <div class="message-time">${time}</div>
                </div>
            `;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        // Определяем получателя заново, так же как в loadChatMessages
        const myPair = this.pairs.find(p => p.santa_id === this.currentUser.id);
        const santaPair = this.pairs.find(p => p.receiver_id === this.currentUser.id);

        let receiverId = null;

        if (this.chatMode === 'recipient') {
             if (myPair) receiverId = myPair.receiver_id;
        } else {
             if (santaPair) receiverId = santaPair.santa_id;
        }

        if (!receiverId) {
            this.showToast('Ошибка: Некому писать!');
            return;
        }

        await supabase.from('messages').insert({
            sender_id: this.currentUser.id,
            receiver_id: receiverId,
            text: text
        });

        input.value = '';
    }

    // --- Общие методы ---

    async fetchPairs() {
        const { data } = await supabase.from('pairs').select('*');
        this.pairs = data || [];
    }

    setupRealtimeSubscription() {
        supabase
            .channel('public:any')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings' }, payload => {
                if (payload.new.key === 'game_active') {
                    this.gameActive = payload.new.value === 'true';
                    this.updateGameStatusUI();
                    if (this.currentUser) {
                         if(this.currentUser.is_admin) this.updateAdminTable();
                         else this.showUserDashboard();
                    }
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                this.fetchUsers().then(() => {
                    if (this.currentUser && this.currentUser.is_admin) this.updateAdminTable();
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                // 1. Если открыт личный чат - обновляем его
                if (document.getElementById('chatScreen').classList.contains('active')) {
                    this.loadChatMessages();
                }

                // 2. Обновляем публичные уведомления
                this.renderSingleNotification(payload.new, true);
            })
            .subscribe();
    }

    updateGameStatusUI() {
        const badge = document.getElementById('gameStatusBadge');
        const btn = document.getElementById('drawButton');
        if (badge && btn) {
            if (this.gameActive) {
                badge.textContent = '✓ Активна';
                badge.className = 'game-status active';
                btn.disabled = true;
            } else {
                badge.textContent = '⏰ Ожидание';
                badge.className = 'game-status waiting';
                btn.disabled = false;
            }
        }
    }

    updateProfileStatusUI() {
        const profileStatus = document.getElementById('profileStatus');
        if (this.currentUser.wishlist) {
            profileStatus.innerHTML = '<strong style="color: var(--secondary-color);">✓ Wishlist заполнен</strong>';
            profileStatus.style.border = '1px solid var(--secondary-color)';
        } else {
            profileStatus.innerHTML = '<strong style="color: var(--primary-color);">⚠ Wishlist пуст</strong>';
            profileStatus.style.border = '1px solid var(--primary-color)';
        }
    }

    createSnowflakes() {
        const container = document.getElementById('snowflakes');
        for (let i = 0; i < 50; i++) {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake');
            snowflake.textContent = '❄';
            snowflake.style.left = Math.random() * 100 + '%';
            snowflake.style.animationDuration = (Math.random() * 3 + 2) + 's';
            snowflake.style.animationDelay = Math.random() * 5 + 's';
            container.appendChild(snowflake);
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    addSafeEventListener(elementId, eventName, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(eventName, handler);
        } else {
            console.warn(`Element with ID "${elementId}" not found. Skipping event listener for "${eventName}".`);
        }
    }

    setupEventListeners() {
        this.addSafeEventListener('loginForm', 'submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // --- Admin Actions ---
        this.addSafeEventListener('drawButton', 'click', () => this.conductDraw());
        this.addSafeEventListener('resetButton', 'click', () => this.resetDraw());
        this.addSafeEventListener('adminLogoutBtn', 'click', () => this.logout());
        this.addSafeEventListener('saveAdminWishlistBtn', 'click', () => this.saveAdminWishlist());
        this.addSafeEventListener('adminOpenChatBtn', 'click', () => this.openAdminChat());
        this.addSafeEventListener('backToUserScreenBtn', 'click', () => this.showUserDashboard());

        // --- User Actions ---
        this.addSafeEventListener('adminDashboardBtn', 'click', () => this.showAdminDashboard());
        this.addSafeEventListener('saveWishlistBtn', 'click', () => this.saveWishlist());
        this.addSafeEventListener('revealGiftBox', 'click', () => this.revealRecipient());
        this.addSafeEventListener('openRecipientChatBtn', 'click', () => this.openChat('recipient'));
        this.addSafeEventListener('openSantaChatBtn', 'click', () => this.openChat('santa'));
        this.addSafeEventListener('userLogoutBtn', 'click', () => this.logout());
        this.addSafeEventListener('profileLogoutBtn', 'click', () => this.logout());

        // --- Chat Actions ---
        this.addSafeEventListener('backToDashboardBtn', 'click', () => this.backToUserDashboard());
        this.addSafeEventListener('sendMessageBtn', 'click', () => this.sendMessage());
        this.addSafeEventListener('chatInput', 'keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    backToUserDashboard() {
        this.showUserDashboard();
    }

    logout() {
        this.currentUser = null;
        this.selectedUserId = null;
        document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('passwordInput').value = '';
        this.showScreen('loginScreen');
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new SecretSantaApp();
        // Expose the app instance to the global scope for easier debugging and verification
        window.app = app;
    } catch (error) {
        console.error("A fatal error occurred during application startup:", error);
        // Display a prominent error message to the user, as the app is unusable.
        document.body.innerHTML = `
            <div style="font-family: sans-serif; color: #fff; background-color: #1a1f3a; text-align: center; padding: 40px; height: 100vh;">
            <h1>Application Error</h1>
            <p>Sorry, the application could not be started due to a critical error.</p>
            <p style="color: #e74c3c; font-weight: bold;">Please contact support and provide the error message below:</p>
            <pre style="background-color: #0a0e27; padding: 15px; border-radius: 8px; text-align: left; color: #ecf0f1;">${error.stack || error.message}</pre>
            </div>
        `;
    }
});
