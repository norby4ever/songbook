// Конфигурация GitHub API
const GITHUB_CONFIG = {
    OWNER: 'norby4ever',           // Замените на свой
    REPO: 'songbook',    // Замените на свой
    FILE_PATH: 'songs.json'
};

const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.FILE_PATH}`;

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

// ========== ОТЛАДОЧНАЯ ФУНКЦИЯ ==========
function logToStatus(message, isError = false) {
    console.log(message);
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${isError ? 'error' : 'saving'}`;
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.textContent = '';
                statusDiv.className = 'status';
            }
        }, 5000);
    }
}

// ========== РАБОТА С ТОКЕНОМ ==========
function getToken() {
    let token = localStorage.getItem('github_token');

    if (!token) {
        token = prompt(
            '🔑 Введите GitHub Personal Access Token\n\n' +
            'Как получить:\n' +
            '1. GitHub → Settings → Developer settings\n' +
            '2. Personal access tokens → Tokens (classic)\n' +
            '3. Выберите scope: repo\n' +
            '4. Создайте и скопируйте токен'
        );

        if (token) {
            localStorage.setItem('github_token', token);
            logToStatus('✅ Токен сохранён');
        }
    }

    return token;
}

// Проверка токена
async function checkToken(token) {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const isValid = response.ok;
        logToStatus(`Проверка токена: ${isValid ? '✅ валиден' : '❌ невалиден'}`);
        return isValid;
    } catch (error) {
        logToStatus(`❌ Ошибка проверки токена: ${error.message}`, true);
        return false;
    }
}

// Кодирование/декодирование
function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
}

// ========== ЗАГРУЗКА С GITHUB ==========
async function loadSongsFromGitHub() {
    const token = getToken();
    if (!token) {
        logToStatus('❌ Нет токена', true);
        return;
    }

    const isValid = await checkToken(token);
    if (!isValid) {
        localStorage.removeItem('github_token');
        logToStatus('❌ Токен невалиден, введите новый', true);
        return;
    }

    logToStatus('📥 Загрузка с GitHub...');

    try {
        // Показываем URL для отладки
        console.log('Запрос к:', API_URL);

        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        console.log('Статус ответа:', response.status);

        if (response.status === 404) {
            logToStatus('📝 Файл songs.json не найден, будет создан');
            currentFileSha = null;
            songs = [];
            renderAll();
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Данные с GitHub:', data);

        currentFileSha = data.sha;
        const content = base64ToUtf8(data.content);
        const jsonData = JSON.parse(content);
        songs = jsonData.songs || [];

        logToStatus(`✅ Загружено ${songs.length} песен`);
        renderAll();

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        logToStatus(`❌ Ошибка: ${error.message}`, true);
    }
}

// ========== СОХРАНЕНИЕ НА GITHUB ==========
async function saveSongsToGitHub() {
    const token = getToken();
    if (!token) {
        logToStatus('❌ Нет токена', true);
        return false;
    }

    logToStatus('💾 Сохранение на GitHub...');

    try {
        const data = { songs: songs };
        const content = JSON.stringify(data, null, 2);
        const encodedContent = utf8ToBase64(content);

        console.log('Сохраняемые данные:', data);
        console.log('SHA файла:', currentFileSha);

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

        console.log('Статус сохранения:', response.status);

        if (!response.ok) {
            const error = await response.json();
            console.error('Ошибка API:', error);
            throw new Error(error.message || 'Ошибка сохранения');
        }

        const result = await response.json();
        currentFileSha = result.content.sha;

        logToStatus('✅ Сохранено на GitHub!');
        localStorage.setItem('songs_backup', JSON.stringify(songs));

        return true;

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        logToStatus(`❌ Ошибка: ${error.message}`, true);
        localStorage.setItem('songs_backup', JSON.stringify(songs));
        return false;
    }
}

// ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========
function generateId() {
    return Date.now();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'));
            editSong(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(btn.getAttribute('data-id'));
            if (confirm('Вы уверены?')) {
                songs = songs.filter(s => s.id !== id);
                await saveSongsToGitHub();
                renderAll();
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

    if (!title || !text) {
        alert('Заполните все поля');
        return;
    }

    if (editId) {
        const index = songs.findIndex(s => s.id === parseInt(editId));
        if (index !== -1) {
            songs[index] = { ...songs[index], title, text };
        }
    } else {
        songs.push({ id: generateId(), title, text });
    }

    const saved = await saveSongsToGitHub();
    if (saved) {
        closeModal();
        renderAll();
        logToStatus('✅ Песня сохранена!');
    } else {
        alert('Ошибка сохранения! Проверьте консоль (F12)');
    }
}

async function syncWithGitHub() {
    localStorage.removeItem('github_token');
    await loadSongsFromGitHub();
}

function closeModal() {
    if (editModal) editModal.style.display = 'none';
}

function handleSearch() {
    renderToc(searchInput.value);
}

function clearSearch() {
    if (searchInput) {
        searchInput.value = '';
        renderToc('');
    }
}

function initEventListeners() {
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);
    if (addSongBtn) addSongBtn.addEventListener('click', addSong);
    if (syncBtn) syncBtn.addEventListener('click', syncWithGitHub);
    if (saveSongBtn) saveSongBtn.addEventListener('click', saveSong);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (editModal && e.target === editModal) closeModal();
    });
}

async function init() {
    initEventListeners();
    await loadSongsFromGitHub();
}

init();
