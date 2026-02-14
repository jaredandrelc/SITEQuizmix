class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {
            correct: new Audio('assets/audio/Correct.mp3'),
            wrong: new Audio('assets/audio/Wrong.mp3'),
            complete: new Audio('assets/audio/Finish.mp3'),
            start: new Audio('assets/audio/Start.mp3'), // Assuming start exists or future
            click: new Audio('assets/audio/Click.mp3'),
            why: new Audio('assets/audio/why.mp3'),
            scorelow: new Audio('assets/audio/scorelow.mp3')
        };

        Object.values(this.sounds).forEach(s => s.load());
        this.enabled = true;
    }

    play(name) {
        if (!this.enabled || !this.sounds[name]) return;
        this.sounds[name].currentTime = 0;
        this.sounds[name].play().catch(e => console.warn("Audio play failed", e));
    }

    click() { this.play('click'); }
    correct() { this.play('correct'); }
    wrong() { this.play('wrong'); }
    complete() { this.play('complete'); }
    why() { this.play('why'); }
    scorelow() { this.play('scorelow'); }
}

const sfx = new SoundManager();

document.addEventListener('click', () => {
    if (sfx.ctx && sfx.ctx.state === 'suspended') sfx.ctx.resume();
}, { once: true });
