// ========== КОНФИГУРАЦИЯ ==========
const GITHUB_CONFIG = {
    OWNER: 'norby4ever',
    REPO: 'songbook',
    BRANCH: 'main'
};

const FILE_PATH = 'songs.json';
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/${GITHUB_CONFIG.BRANCH}/${FILE_PATH}`;
const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${FILE_PATH}`;

// Глобальные переменные
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

// ========== СОРТИРОВКА ==========
function sortSongs() {
    songs.sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;
        return 0;
    });
}

// ========== ТОКЕН ==========
function getToken() {
    let token = localStorage.getItem('github_token');
    if (!token) {
        token = prompt(
            '🔑 Введите GitHub Personal Access Token\n\n' +
            'Токен нужен ДЛЯ СОХРАНЕНИЯ песен.\n' +
            'Для просмотра токен не нужен.'
        );
        if (token) {
            localStorage.setItem('github_token', token);
        }
    }
    return token;
}

function setStatus(message, isError = false) {
    console.log(message);
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${isError ? 'error' : 'saving'}`;
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.textContent = '';
                statusDiv.className = 'status';
            }
        }, 3000);
    }
}

function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// ========== ЗАГРУЗКА ==========
async function loadSongsFromGitHub() {
    setStatus('📥 Загрузка песен...');

    try {
        // Пробуем загрузить через raw.githubusercontent.com
        const response = await fetch(RAW_URL);

        if (response.status === 404) {
            setStatus('📝 Создаём новый файл песен');
            songs = [];
            sortSongs();
            renderAll();
            return true;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const content = await response.text();
        const jsonData = JSON.parse(content);
        songs = jsonData.songs || [];
        sortSongs();

        setStatus(`✅ Загружено ${songs.length} песен`);
        renderAll();
        return true;

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        setStatus(`❌ Ошибка: ${error.message}`, true);

        // Пробуем загрузить из localStorage
        const backup = localStorage.getItem('songs_backup');
        if (backup) {
            songs = JSON.parse(backup);
            sortSongs();
            renderAll();
            setStatus('📱 Загружена локальная копия');
        }
        return false;
    }
}

// ========== СОХРАНЕНИЕ ==========
async function saveSongsToGitHub() {
    const token = getToken();
    if (!token) {
        setStatus('❌ Для сохранения нужен токен', true);
        return false;
    }

    // Проверяем, есть ли песни для сохранения
    if (songs.length === 0) {
        setStatus('⚠️ Нет песен для сохранения', true);
        return false;
    }

    setStatus('💾 Сохранение на GitHub...');

    try {
        sortSongs();

        // Формируем данные для сохранения
        const data = { songs: songs };
        const content = JSON.stringify(data, null, 2);
        const encodedContent = utf8ToBase64(content);

        console.log('Сохраняемые данные:', data);
        console.log('Количество песен:', songs.length);

        // Получаем текущий SHA файла
        const getResponse = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        let shaToUse = null;
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            shaToUse = fileData.sha;
            console.log('SHA файла:', shaToUse);
        } else if (getResponse.status === 404) {
            console.log('Файл не существует, будет создан');
        } else {
            throw new Error(`Ошибка получения SHA: ${getResponse.status}`);
        }

        // Формируем запрос
        const requestBody = {
            message: `Обновление песенника: ${new Date().toLocaleString('ru-RU')}`,
            content: encodedContent,
            branch: GITHUB_CONFIG.BRANCH
        };

        if (shaToUse) {
            requestBody.sha = shaToUse;
        }

        // Отправляем на GitHub
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
            console.error('Ошибка API:', error);
            throw new Error(error.message || 'Ошибка сохранения');
        }

        const result = await response.json();
        currentFileSha = result.content.sha;

        // Сохраняем резервную копию
        localStorage.setItem('songs_backup', JSON.stringify(songs));

        setStatus(`✅ Сохранено ${songs.length} песен на GitHub!`);
        console.log('Сохранение успешно!');
        return true;

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        setStatus(`❌ Ошибка: ${error.message}`, true);
        localStorage.setItem('songs_backup', JSON.stringify(songs));
        return false;
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
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
    let filteredSongs = filterLower === ''
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
            const id = parseFloat(btn.getAttribute('data-id'));
            editSong(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseFloat(btn.getAttribute('data-id'));
            if (confirm('Вы уверены, что хотите удалить эту песню?')) {
                songs = songs.filter(s => s.id !== id);
                sortSongs();
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

// ========== КРУД ==========
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
        alert('Введите название песни');
        return;
    }

    if (!text) {
        alert('Введите текст песни');
        return;
    }

    if (editId) {
        // Редактирование
        const index = songs.findIndex(s => s.id === parseFloat(editId));
        if (index !== -1) {
            songs[index] = { ...songs[index], title, text };
        }
    } else {
        // Добавление
        const newSong = {
            id: generateId(),
            title: title,
            text: text
        };
        songs.push(newSong);
        console.log('Добавлена новая песня:', newSong);
    }

    console.log('Всего песен после операции:', songs.length);
    sortSongs();

    const saved = await saveSongsToGitHub();
    if (saved) {
        closeModal();
        renderAll();
        setStatus('✅ Песня сохранена!');
    } else {
        alert('Ошибка сохранения! Проверьте консоль (F12)');
    }
}

async function syncWithGitHub() {
    setStatus('🔄 Синхронизация...');
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
        if (editModal && e.target === editModal) closeModal();
    });
}

async function init() {
    initEventListeners();
    await loadSongsFromGitHub();
}

init();
