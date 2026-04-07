// Конфигурация GitHub API
const GITHUB_CONFIG = {
    OWNER: 'norby4ever',           // Ваше имя пользователя на GitHub
    REPO: 'songbook',    // Название репозитория
    FILE_PATH: 'songs.json'          // Путь к файлу с данными
};

const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.FILE_PATH}`;

// Данные
let songs = [];
let currentFileSha = null;

// DOM элементы
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const tocDiv = document.getElementById('toc');
const songsContainer = document.getElementById('songsContainer');
const addSongBtn = document.getElementById('addSongBtn');
const syncBtn = document.getElementById('syncBtn');
const statusDiv = document.getElementById('status');
const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const songTitleInput = document.getElementById('songTitle');
const songTextInput = document.getElementById('songText');
const editIdInput = document.getElementById('editId');
const saveSongBtn = document.getElementById('saveSongBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeBtn = document.querySelector('.close');

// ========== РАБОТА С ТОКЕНОМ ==========

// Получение токена (из localStorage или запрос у пользователя)
function getToken() {
    let token = localStorage.getItem('github_token');

    if (!token) {
        token = prompt(
            '🔑 Для синхронизации песен нужен GitHub Personal Access Token.\n\n' +
            'Как получить токен:\n' +
            '1. Перейдите на github.com → Settings → Developer settings\n' +
            '2. Personal access tokens → Tokens (classic) → Generate new token\n' +
            '3. Отметьте галочку "repo" (полный доступ)\n' +
            '4. Скопируйте созданный токен и вставьте его сюда\n\n' +
            'Токен будет сохранён в вашем браузере и никуда не отправится.'
        );

        if (token) {
            localStorage.setItem('github_token', token);
            setStatus('✅ Токен сохранён в браузере', 'synced');
        } else {
            setStatus('❌ Токен не введён. Синхронизация невозможна', 'error');
        }
    }

    return token;
}

// Сброс токена (для отладки или смены пользователя)
function resetToken() {
    localStorage.removeItem('github_token');
    setStatus('🔄 Токен сброшен. Обновите страницу', 'saving');
    setTimeout(() => location.reload(), 1500);
}

// Проверка валидности токена
async function validateToken(token) {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.ok;
    } catch {
        return false;
    }
}

// ========== РАБОТА С GITHUB API ==========

// Кодирование строки в Base64 (с поддержкой UTF-8)
function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// Декодирование из Base64
function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
}

// Загрузка данных с GitHub
async function loadSongsFromGitHub() {
    const token = getToken();
    if (!token) {
        showEmptyState();
        return;
    }

    // Проверяем валидность токена
    const isValid = await validateToken(token);
    if (!isValid) {
        setStatus('❌ Токен недействителен. Нажмите "Синхронизировать" для ввода нового', 'error');
        localStorage.removeItem('github_token');
        showEmptyState();
        return;
    }

    setStatus('📥 Загрузка с GitHub...', 'saving');
    showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (response.status === 404) {
            // Файл не существует, создаём пустой
            currentFileSha = null;
            songs = [];
            setStatus('📝 Новый файл будет создан при первом сохранении', 'synced');
            renderAll();
            return;
        }

        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        currentFileSha = data.sha;

        // Декодируем содержимое
        const content = base64ToUtf8(data.content);
        const jsonData = JSON.parse(content);
        songs = jsonData.songs || [];

        setStatus(`✅ Загружено ${songs.length} песен`, 'synced');
        renderAll();

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        setStatus(`❌ Ошибка: ${error.message}`, 'error');

        // Пробуем загрузить локальную копию
        const local = localStorage.getItem('songs_backup');
        if (local) {
            songs = JSON.parse(local);
            setStatus('📱 Загружена локальная копия', 'synced');
            renderAll();
        } else {
            showEmptyState();
        }
    } finally {
        hideLoading();
    }
}

// Сохранение данных на GitHub
async function saveSongsToGitHub() {
    const token = getToken();
    if (!token) {
        setStatus('❌ Нет токена. Синхронизация невозможна', 'error');
        return false;
    }

    setStatus('💾 Сохранение на GitHub...', 'saving');

    try {
        const data = { songs: songs };
        const content = JSON.stringify(data, null, 2);
        const encodedContent = utf8ToBase64(content);

        const requestBody = {
            message: `Обновление песенника: ${new Date().toLocaleString('ru-RU')}`,
            content: encodedContent,
            sha: currentFileSha || undefined
        };

        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка сохранения');
        }

        const result = await response.json();
        currentFileSha = result.content.sha;

        setStatus('✅ Сохранено на GitHub!', 'synced');

        // Сохраняем локальную копию
        localStorage.setItem('songs_backup', JSON.stringify(songs));

        return true;

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        setStatus(`❌ Ошибка: ${error.message}`, 'error');

        // Сохраняем локально как запасной вариант
        localStorage.setItem('songs_backup', JSON.stringify(songs));
        setStatus('💾 Сохранено только локально', 'saving');

        return false;
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function setStatus(message, type = 'synced') {
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
        if (statusDiv.textContent === message) {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }
    }, 3000);
}

function showLoading() {
    if (songsContainer) {
        songsContainer.innerHTML = '<div class="loading">⏳ Загрузка песен...</div>';
    }
}

function hideLoading() {}

function showEmptyState() {
    if (songsContainer) {
        songsContainer.innerHTML = '<div class="empty-message">📝 Введите токен для синхронизации</div>';
    }
}

function generateId() {
    return Date.now();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== РЕНДЕРИНГ ==========

function renderToc(filter = '') {
    if (!tocDiv) return;

    const filterLower = filter.toLowerCase().trim();
    const filteredSongs = filterLower === ''
        ? songs
        : songs.filter(song => song.title.toLowerCase().includes(filterLower));

    if (filteredSongs.length === 0) {
        tocDiv.innerHTML = '<p class="empty-message">😔 Песни не найдены</p>';
        return;
    }

    tocDiv.innerHTML = filteredSongs.map(song =>
        `<a href="#song-${song.id}">${escapeHtml(song.title)}</a>`
    ).join('');
}

function renderSongs() {
    if (!songsContainer) return;

    if (songs.length === 0) {
        songsContainer.innerHTML = '<div class="empty-message">📝 Пока нет песен. Добавьте первую!</div>';
        return;
    }

    songsContainer.innerHTML = songs.map(song => `
        <div class="song" id="song-${song.id}">
            <div class="song-header">
                <h2>${escapeHtml(song.title)}</h2>
                <div>
                    <button class="edit-btn" data-id="${song.id}">✏️ Редактировать</button>
                    <button class="delete-btn" data-id="${song.id}">🗑 Удалить</button>
                </div>
            </div>
            <div class="song-content">${escapeHtml(song.text)}</div>
            <a href="#" class="back-to-top">⬆ Наверх</a>
        </div>
    `).join('');

    // Обработчики для кнопок
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'));
            editSong(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(btn.getAttribute('data-id'));
            if (confirm('Вы уверены, что хотите удалить эту песню?')) {
                await deleteSong(id);
            }
        });
    });

    document.querySelectorAll('.back-to-top').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function renderAll() {
    const searchTerm = searchInput ? searchInput.value : '';
    renderToc(searchTerm);
    renderSongs();
}

// ========== КРУД ОПЕРАЦИИ ==========

function addSong() {
    if (!editModal) return;
    modalTitle.textContent = 'Добавить песню';
    songTitleInput.value = '';
    songTextInput.value = '';
    editIdInput.value = '';
    editModal.style.display = 'block';
}

function editSong(id) {
    const song = songs.find(s => s.id === id);
    if (song && editModal) {
        modalTitle.textContent = 'Редактировать песню';
        songTitleInput.value = song.title;
        songTextInput.value = song.text;
        editIdInput.value = song.id;
        editModal.style.display = 'block';
    }
}

async function saveSong() {
    const title = songTitleInput.value.trim();
    const text = songTextInput.value;
    const editId = editIdInput.value;

    if (!title) {
        alert('Пожалуйста, введите название песни');
        return;
    }

    if (!text) {
        alert('Пожалуйста, введите текст песни');
        return;
    }

    if (editId) {
        // Редактирование
        const index = songs.findIndex(s => s.id === parseInt(editId));
        if (index !== -1) {
            songs[index] = { ...songs[index], title, text };
        }
    } else {
        // Добавление
        songs.push({
            id: generateId(),
            title: title,
            text: text
        });
    }

    await saveSongsToGitHub();
    closeModal();
    renderAll();
}

async function deleteSong(id) {
    songs = songs.filter(s => s.id !== id);
    await saveSongsToGitHub();
    renderAll();
    setStatus('🗑 Песня удалена', 'saving');
}

async function syncWithGitHub() {
    // Принудительно запрашиваем новый токен
    localStorage.removeItem('github_token');
    await loadSongsFromGitHub();
    setStatus('🔄 Синхронизация завершена', 'synced');
}

function closeModal() {
    if (editModal) {
        editModal.style.display = 'none';
    }
}

function handleSearch() {
    renderToc(searchInput.value);
}

function clearSearch() {
    if (searchInput) {
        searchInput.value = '';
        renderToc('');
        searchInput.focus();
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

function initEventListeners() {
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);
    if (addSongBtn) addSongBtn.addEventListener('click', addSong);
    if (syncBtn) syncBtn.addEventListener('click', syncWithGitHub);
    if (saveSongBtn) saveSongBtn.addEventListener('click', saveSong);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (editModal && e.target === editModal) {
            closeModal();
        }
    });
}

async function init() {
    initEventListeners();
    await loadSongsFromGitHub();
}

// Запуск приложения
init();
