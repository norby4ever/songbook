// Данные
let songs = [];

// DOM элементы
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const tocDiv = document.getElementById('toc');
const songsContainer = document.getElementById('songsContainer');
const addSongBtn = document.getElementById('addSongBtn');
const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const songTitleInput = document.getElementById('songTitle');
const songTextInput = document.getElementById('songText');
const editIdInput = document.getElementById('editId');
const saveSongBtn = document.getElementById('saveSongBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeBtn = document.querySelector('.close');

// Загрузка данных из localStorage
function loadSongs() {
    const stored = localStorage.getItem('songs');
    if (stored) {
        songs = JSON.parse(stored);
    } else {
        // Пример песен для демонстрации
        songs = [
            {
                id: Date.now() + 1,
                title: 'Катюша',
                text: 'Расцветали яблони и груши,\nПоплыли туманы над рекой.\nВыходила на берег Катюша,\nНа высокий берег, на крутой.'
            },
            {
                id: Date.now() + 2,
                title: 'В лесу родилась ёлочка',
                text: 'В лесу родилась ёлочка,\nВ лесу она росла.\nЗимой и летом стройная,\nЗелёная была.'
            }
        ];
        saveToLocalStorage();
    }
    renderAll();
}

// Сохранение в localStorage
function saveToLocalStorage() {
    localStorage.setItem('songs', JSON.stringify(songs));
}

// Генерация уникального ID
function generateId() {
    return Date.now();
}

// Экранирование HTML для безопасности
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Рендер оглавления с фильтром
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
    
    songsContainer.innerHTML = songs.map((song, index) => `
        <div class="song" id="song-${song.id}">
            <div class="song-header">
                <h2>${escapeHtml(song.title)}</h2>
                <button class="edit-btn" data-id="${song.id}">✏️ Редактировать</button>
            </div>
            <div class="song-content">${escapeHtml(song.text)}</div>
            <a href="#" class="back-to-top">⬆ Наверх</a>
        </div>
    `).join('');
    
    // Добавляем обработчики для кнопок редактирования
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'));
            editSong(id);
        });
    });
    
    // Добавляем плавную прокрутку для якорей
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

// Сохранение песни (добавление или редактирование)
function saveSong() {
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
        // Редактирование существующей
        const index = songs.findIndex(s => s.id === parseInt(editId));
        if (index !== -1) {
            songs[index] = { ...songs[index], title, text };
        }
    } else {
        // Добавление новой
        const newSong = {
            id: generateId(),
            title: title,
            text: text
        };
        songs.push(newSong);
    }
    
    saveToLocalStorage();
    closeModal();
    renderAll();
}

// Закрытие модального окна
function closeModal() {
    editModal.style.display = 'none';
}

// Обработка поиска
function handleSearch() {
    renderToc(searchInput.value);
    // Не перерисовываем песни, только оглавление
}

// Очистка поиска
function clearSearch() {
    searchInput.value = '';
    renderToc('');
    searchInput.focus();
}

// Обработчики событий
function initEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    addSongBtn.addEventListener('click', addSong);
    saveSongBtn.addEventListener('click', saveSong);
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    // Закрытие модалки при клике вне области
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeModal();
        }
    });
    
    // Обработка клавиши Enter в поле поиска (предотвращаем submit)
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });
}

// Инициализация
function init() {
    loadSongs();
    initEventListeners();
}

// Запуск приложения
init();