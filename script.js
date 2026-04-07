// ========== КОНФИГУРАЦИЯ ==========
const GITHUB_CONFIG = {
    OWNER: 'norby4ever',
    REPO: 'songbook',
    BRANCH: 'main'
};

const FILE_PATH = 'songs.json';
const API_URL = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${FILE_PATH}`;

// Функция для получения URL с anti-cache параметром
function getRawUrl() {
    // Добавляем timestamp, чтобы избежать кэширования
    return `https://raw.githubusercontent.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/${GITHUB_CONFIG.BRANCH}/${FILE_PATH}?t=${Date.now()}`;
}

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

function sortSongs() {
    songs.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
}

function getToken() {
    let token = localStorage.getItem('github_token');
    if (!token) {
        token = prompt('🔑 Введите GitHub Personal Access Token (нужен для сохранения)');
        if (token) localStorage.setItem('github_token', token);
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

// ========== ЗАГРУЗКА (без кэша) ==========
async function loadSongs() {
    setStatus('📥 Загрузка песен...');
    try {
        const url = getRawUrl(); // Свежий URL с timestamp
        console.log('Загрузка с:', url);

        const response = await fetch(url, {
            cache: 'no-store',  // Запрещаем кэширование
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const jsonData = await response.json();
        songs = jsonData.songs || [];
        sortSongs();

        console.log('Загружены песни:', songs.map(s => s.title));
        setStatus(`✅ Загружено ${songs.length} песен`);
        renderAll();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        setStatus(`❌ Ошибка: ${error.message}`, true);
        songs = [];
        renderAll();
    }
}

// ========== СОХРАНЕНИЕ ==========
async function saveSongs() {
    const token = getToken();
    if (!token) {
        setStatus('❌ Токен не введён', true);
        return false;
    }

    setStatus('💾 Сохранение...');

    try {
        sortSongs();

        const content = JSON.stringify({ songs: songs }, null, 2);
        const encodedContent = utf8ToBase64(content);

        console.log('Сохраняем песен:', songs.length);
        console.log('Содержимое:', content.substring(0, 200));

        // Получаем текущий SHA
        const getRes = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let sha = null;
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
            console.log('SHA файла:', sha);
        } else if (getRes.status !== 404) {
            throw new Error(`Ошибка получения файла: ${getRes.status}`);
        }

        // Сохраняем
        const body = {
            message: `Обновление: ${new Date().toLocaleString()}`,
            content: encodedContent,
            branch: GITHUB_CONFIG.BRANCH
        };
        if (sha) body.sha = sha;

        const putRes = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!putRes.ok) {
            const error = await putRes.json();
            throw new Error(error.message || `HTTP ${putRes.status}`);
        }

        localStorage.setItem('songs_backup', JSON.stringify(songs));
        setStatus(`✅ Сохранено ${songs.length} песен!`);

        // После сохранения ПРИНУДИТЕЛЬНО перезагружаем (сбрасываем кэш)
        setTimeout(() => {
            loadSongs();
        }, 500);

        return true;

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        setStatus(`❌ Ошибка: ${error.message}`, true);
        localStorage.setItem('songs_backup', JSON.stringify(songs));
        return false;
    }
}

// ========== ОСТАЛЬНЫЕ ФУНКЦИИ (те же) ==========
function renderToc(filter = '') {
    if (!tocDiv) return;
    const filtered = filter ? songs.filter(s => s.title.toLowerCase().includes(filter.toLowerCase())) : songs;
    if (filtered.length === 0) {
        tocDiv.innerHTML = '<p class="empty-message">😔 Песни не найдены</p>';
        return;
    }
    tocDiv.innerHTML = filtered.map(song => `<a href="#song-${song.id}">${escapeHtml(song.title)}</a>`).join('');
}

function renderSongs() {
    if (!songsContainer) return;
    if (songs.length === 0) {
        songsContainer.innerHTML = '<div class="empty-message">📝 Нет песен. Добавьте первую!</div>';
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
        btn.addEventListener('click', () => editSong(parseFloat(btn.dataset.id)));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Удалить песню?')) {
                songs = songs.filter(s => s.id !== parseFloat(btn.dataset.id));
                await saveSongs();
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
    renderToc(searchInput?.value || '');
    renderSongs();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateId() {
    return Date.now();
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
    if (song) {
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
        const idx = songs.findIndex(s => s.id === parseFloat(editId));
        if (idx !== -1) songs[idx] = { ...songs[idx], title, text };
    } else {
        songs.push({ id: generateId(), title, text });
    }

    sortSongs();
    await saveSongs();
    closeModal();
}

function closeModal() {
    editModal.style.display = 'none';
}

function initEventListeners() {
    if (searchInput) searchInput.addEventListener('input', () => renderToc(searchInput.value));
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        renderToc('');
    });
    if (addSongBtn) addSongBtn.addEventListener('click', addSong);
    if (syncBtn) syncBtn.addEventListener('click', loadSongs);
    if (saveSongBtn) saveSongBtn.addEventListener('click', saveSong);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });
}

async function init() {
    initEventListeners();
    await loadSongs();
}

init();
