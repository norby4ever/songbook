// Конфигурация GitHub API
const GITHUB_CONFIG = {
    OWNER: 'norby4ever',           // Ваше имя пользователя на GitHub
    REPO: 'songbook',    // Название репозитория
    FILE_PATH: 'songs.json',         // Путь к файлу с данными
    TOKEN: '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'     // Personal Access Token
};

const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.FILE_PATH}`;

// Данные
let songs = [];
let currentFileSha = null; // SHA нужен для обновления файла

// DOM элементы (как в предыдущей версии)
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

// Установка статуса
function setStatus(message, type = 'synced') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
        if (statusDiv.textContent === message) {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }
    }, 3000);
}

// Кодирование строки в Base64 с поддержкой UTF-8
function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// Декодирование из Base64
function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
}

// Загрузка данных с GitHub
async function loadSongsFromGitHub() {
    setStatus('📥 Загрузка с GitHub...', 'saving');
    isLoading = true;
    showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${GITHUB_CONFIG.TOKEN}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Файл не существует, создаём пустой
                currentFileSha = null;
                songs = [];
                setStatus('📝 Новый файл будет создан', 'synced');
                renderAll();
                return;
            }
            throw new Error(`Ошибка загрузки: ${response.statusText}`);
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
        console.error('Ошибка:', error);
        setStatus('❌ Ошибка загрузки с GitHub', 'error');

        // Пробуем загрузить локальную копию
        const local = localStorage.getItem('songs_backup');
        if (local) {
            songs = JSON.parse(local);
            setStatus('📱 Загружена локальная копия', 'synced');
            renderAll();
        }
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// Сохранение данных на GitHub
async function saveSongsToGitHub() {
    setStatus('💾 Сохранение на GitHub...', 'saving');

    try {
        const data = { songs: songs };
        const content = JSON.stringify(data, null, 2);
        const encodedContent = utf8ToBase64(content);

        const requestBody = {
            message: `Обновление песенника: ${new Date().toLocaleString()}`,
            content: encodedContent,
            sha: currentFileSha || undefined
        };

        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_CONFIG.TOKEN}`,
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
        setStatus('❌ Ошибка сохранения на GitHub', 'error');

        // Сохраняем локально
        localStorage.setItem('songs_backup', JSON.stringify(songs));
        setStatus('💾 Сохранено локально', 'saving');

        return false;
    }
}

// Остальные функции (генерация ID, рендер, добавление/удаление)
// остаются такими же, как в предыдущей версии,
// но в конце каждого изменения вызываем saveSongsToGitHub()

// Генерация уникального ID
function generateId() {
    return Date.now();
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Рендер оглавления
function renderToc(filter = '') {
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

// Рендер всех песен
function renderSongs() {
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

// Полный рендер
function renderAll() {
    const searchTerm = searchInput.value;
    renderToc(searchTerm);
    renderSongs();
}

// Добавление песни
function addSong() {
    modalTitle.textContent = 'Добавить песню';
    songTitleInput.value = '';
    songTextInput.value = '';
    editIdInput.value = '';
    editModal.style.display = 'block';
}

// Редактирование песни
function editSong(id) {
    const song = songs.find(s => s.id === id);
    if (song) {
        modalTitle.textContent = 'Редактировать песню';
        songTitleInput.value = song.title;
        songTextInput.value = song.text;
        editIdInput.value = song.id;
        editModal.style.display = 'block';
    }
}

// Сохранение песни
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

// Удаление песни
async function deleteSong(id) {
    songs = songs.filter(s => s.id !== id);
    await saveSongsToGitHub();
    renderAll();
    setStatus('🗑 Песня удалена', 'saving');
}

// Синхронизация
async function syncWithGitHub() {
    await loadSongsFromGitHub();
    setStatus('🔄 Синхронизация завершена', 'synced');
}

// Закрытие модального окна
function closeModal() {
    editModal.style.display = 'none';
}

// Поиск
function handleSearch() {
    renderToc(searchInput.value);
}

function clearSearch() {
    searchInput.value = '';
    renderToc('');
    searchInput.focus();
}

function showLoading() {
    songsContainer.innerHTML = '<div class="loading">⏳ Загрузка песен...</div>';
}

function hideLoading() {}

// Инициализация
function initEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    addSongBtn.addEventListener('click', addSong);
    syncBtn.addEventListener('click', syncWithGitHub);
    saveSongBtn.addEventListener('click', saveSong);
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });
}

// Запуск
async function init() {
    initEventListeners();
    await loadSongsFromGitHub();
}

init();
