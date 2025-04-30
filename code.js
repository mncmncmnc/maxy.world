// clock CODE

let clockInterval;

function updateTime(k) {
    return k < 10 ? "0" + k : k;
}

function currentTime() {
    const date = new Date();
    const hour = updateTime(date.getHours());
    const min = updateTime(date.getMinutes());
    const sec = updateTime(date.getSeconds());
    document.getElementById("clock").innerText = `${hour} : ${min} : ${sec}`;
}

document.addEventListener("DOMContentLoaded", function () {
    currentTime(); // Initial call to display time immediately
    clockInterval = setInterval(currentTime, 1000); // Update every second
});

// Cleanup function using beforeunload instead of unload
window.addEventListener('beforeunload', function() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }
});
