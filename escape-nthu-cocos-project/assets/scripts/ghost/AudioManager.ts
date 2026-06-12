const { ccclass } = cc._decorator;

@ccclass
export default class AudioManager extends cc.Component {

    static instance: AudioManager = null;

    private clipCache: Map<string, cc.AudioClip> = new Map();
    private fadingOut: boolean = false;
    private fadeTarget: number = 0;
    private fadeDuration: number = 0;
    private fadeElapsed: number = 0;
    private fadeStartVol: number = 0;

    onLoad() {
        if (AudioManager.instance) {
            this.node.destroy();
            return;
        }
        AudioManager.instance = this;
    }

    playBGM(clipPath: string, loop: boolean = true, volume: number = 0.7): void {
        this.stopBGM();

        const cached = this.clipCache.get(clipPath);
        if (cached) {
            cc.audioEngine.playMusic(cached, loop);
            cc.audioEngine.setMusicVolume(volume);
            return;
        }

        cc.resources.load(clipPath, cc.AudioClip, (err: Error, clip: cc.AudioClip) => {
            if (err) {
                cc.error("[AudioManager] Failed to load BGM: " + clipPath, err);
                return;
            }
            this.clipCache.set(clipPath, clip);
            cc.audioEngine.playMusic(clip, loop);
            cc.audioEngine.setMusicVolume(volume);
        });
    }

    stopBGM(): void {
        this.fadingOut = false;
        cc.audioEngine.stopMusic();
    }

    fadeOutBGM(duration: number = 1.0): void {
        this.fadingOut = true;
        this.fadeStartVol = cc.audioEngine.getMusicVolume();
        this.fadeTarget = 0;
        this.fadeDuration = duration;
        this.fadeElapsed = 0;
    }

    playSFX(clipPath: string, volume: number = 1.0): void {
        const cached = this.clipCache.get(clipPath);
        if (cached) {
            cc.audioEngine.playEffect(cached, false);
            cc.audioEngine.setEffectsVolume(volume);
            return;
        }

        cc.resources.load(clipPath, cc.AudioClip, (err: Error, clip: cc.AudioClip) => {
            if (err) {
                cc.error("[AudioManager] Failed to load SFX: " + clipPath, err);
                return;
            }
            this.clipCache.set(clipPath, clip);
            cc.audioEngine.playEffect(clip, false);
            cc.audioEngine.setEffectsVolume(volume);
        });
    }

    update(dt: number) {
        if (!this.fadingOut) return;

        this.fadeElapsed += dt;
        const t = Math.min(this.fadeElapsed / this.fadeDuration, 1);
        cc.audioEngine.setMusicVolume(this.fadeStartVol * (1 - t));

        if (t >= 1) {
            this.fadingOut = false;
            cc.audioEngine.stopMusic();
        }
    }
}
