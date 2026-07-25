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

function setPanelIframes(panel, load) {
    if (!panel) return;
    panel.querySelectorAll("iframe[data-src]").forEach(function (iframe) {
        if (load) {
            if (!iframe.getAttribute("src")) {
                iframe.setAttribute("src", iframe.getAttribute("data-src"));
            }
        } else {
            iframe.removeAttribute("src");
        }
    });
}

function openProject(id) {
    const overlay = document.getElementById("project-overlay");
    const panel = document.getElementById("project-" + id);
    if (!overlay || !panel) return;

    overlay.querySelectorAll(".project-panel.is-active").forEach(function (openPanel) {
        openPanel.classList.remove("is-active");
        setPanelIframes(openPanel, false);
    });

    panel.classList.add("is-active");
    setPanelIframes(panel, true);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    overlay.scrollTop = 0;
}

function closeProject() {
    const overlay = document.getElementById("project-overlay");
    if (!overlay) return;

    overlay.querySelectorAll(".project-panel.is-active").forEach(function (panel) {
        panel.classList.remove("is-active");
        setPanelIframes(panel, false);
    });
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", function () {
    currentTime(); // Initial call to display time immediately
    clockInterval = setInterval(currentTime, 1000); // Update every second

    document.querySelectorAll("a[data-project]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            openProject(link.getAttribute("data-project"));
        });
    });

    const back = document.querySelector("#project-overlay .back a");
    if (back) {
        back.addEventListener("click", function (event) {
            event.preventDefault();
            closeProject();
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeProject();
        }
    });
});

// Cleanup function using beforeunload instead of unload
window.addEventListener('beforeunload', function() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }
});
