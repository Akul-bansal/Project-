const timer = document.getElementById("timer");
const start = document.getElementById("start");
const reset = document.getElementById("reset");

// start.addEventListener("click",() => {
// console.log("start clicked");
// timer.textContent= "00:00:01";
// })

// reset.addEventListener("click",() => {
// console.log("reset clicked");
// timer.textContent= "00:00:00";
// })

let intervalid = null;
let second = 0;
function formattime(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return String(hrs).padStart(2, "0") + ":" +
        String(mins).padStart(2, "0") + ":" +
        String(s).padStart(2, "0");
}

// start.addEventListener("click",()=> {
//     if(intervalid) return;
//     intervalid=setInterval(()=>{
//         second++;
//         timer.textContent=formattime(second);
//     } ,1000);
// 
// });
reset.addEventListener("click", () => {
    clearInterval(intervalid);
    intervalid = null;
    isrunning = false;
    ispaused = false;
    start.style.display = "inline-block";
    pause.style.display = "none";
    resume.style.display = "none";
    end.style.display = "none";
    second = 0;
    breaksecond = 0;
    logs.length = 0;

    document.getElementById("switchCount").textContent = 0;
    document.getElementById("idleCount").textContent = 0;

    document.getElementById("box5").style.display = "none";
    timer.textContent = formattime(second);
    logevent("reset");

});

const pause = document.getElementById("pause");
const end = document.getElementById("end");
const resume = document.getElementById("resume");

let isrunning = false;
let ispaused = false;

start.addEventListener("click", () => {
    if (isrunning) return;
    isrunning = true;
    ispaused = false;
    start.style.display = "none";
    pause.style.display = "inline-block";
    end.style.display = "inline-block";
    document.getElementById("box5").style.display = "none";
    intervalid = setInterval(() => {
        second++;
        timer.textContent = formattime(second);


    }, 1000);
    logevent("start");
});

pause.addEventListener("click", () => {
    if (!isrunning || ispaused) return;
    clearInterval(intervalid);
    onPause();
    intervalid = null;
    ispaused = true;
    pause.style.display = "none";
    resume.style.display = "inline-block";
    logevent("pause");

});
resume.addEventListener("click", () => {
    if (!ispaused) return;
    ispaused = false;
    onResume();
    resume.style.display = "none";
    pause.style.display = "inline-block";
    intervalid = setInterval(() => {
        second++;
        timer.textContent = formattime(second);

    }, 1000);
    logevent("resume");
});


end.addEventListener("click", () => {
    clearInterval(intervalid);
    timer.textContent = formattime(second);
    intervalid = null;
    ispaused = false;
    isrunning = false;

    start.style.display = "inline-block";
    pause.style.display = "none";
    resume.style.display = "none";
    end.style.display = "none";
    logevent("end");
    alert("Session ended. Scroll down to view scorecard.");
    timer.textContent = formattime(0);

    const studymin = formattime(second);
    const breakmin = formattime(breaksecond);
    const tabswitchcount = logs.filter(I => I.type === "tab-switch").length;
    const idlecount = logs.filter(I => I.type === "idle").length;

    document.getElementById("scoreStudy").textContent = studymin;
    document.getElementById("scoreBreak").textContent = breakmin;
    document.getElementById("scoreSwitches").textContent = tabswitchcount;
    document.getElementById("scoreIdle").textContent = idlecount;

    document.getElementById("box5").style.display = "flex";



    second = 0;
    breaksecond = 0;
    logs.length = 0;

});

const logs = [];
function logevent(type) {
    const timeStr = formattime(second);
    logs.push({ type, time: timeStr });
    console.log("logged:", type, timeStr)
}
document.addEventListener("visibilitychange", () => {
    if (document.hidden && isrunning && !ispaused) {
        clearInterval(intervalid);
        onPause();
        intervalid = null;
        ispaused = true;
        pause.style.display = "none";
        resume.style.display = "inline-block";
        logevent("tab-switch");
        const count = logs.filter(l => l.type === "tab-switch").length;
        document.getElementById("switchCount").textContent = count;
        document.getElementById("scoreSwitches").textContent = count;
        alert("Timer paused due to tab switch");
    }
})

let idletimeout;
function resetidletimer() {
    clearTimeout(idletimeout);
    idletimeout = setTimeout(() => {
        if (isrunning && !ispaused) {
            clearInterval(intervalid);
            onPause();
            intervalid = null;
            ispaused = true;
            pause.style.display = "none";
            resume.style.display = "inline-block";
            logevent("idle");
            const idle = logs.filter(l => l.type === "idle").length;
            document.getElementById("idleCount").textContent = idle;
            document.getElementById("scoreIdle").textContent = idle;
            alert("You were idle - time paused.");
        }

    }, 15000);
}
["mousemove", "keydown", "click", "scroll"].forEach(evt => {
    document.addEventListener(evt, resetidletimer);
});
let breaksecond = 0;
let lastpausedat = null;
function onPause() {
    lastpausedat = Date.now();
}
function onResume() {
    if (lastpausedat) {
        breaksecond += Math.floor((Date.now() - lastpausedat) / 1000);
        lastpausedat = null;
    }
}