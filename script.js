const input = document.getElementById('msg-input');
const chatBox = document.getElementById('chat-box');

input.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && input.value.trim() !== "") {
        const messageHTML = `
            <div class="msg-card">
                <div class="avatar" style="background: #23a559;">S</div>
                <div class="msg-content">
                    <div class="user-info">Sen <span class="time">Şimdi</span></div>
                    <div class="text">${input.value}</div>
                </div>
            </div>
        `;
        chatBox.insertAdjacentHTML('beforeend', messageHTML);
        input.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});

