export type AuthSession = {
    email: string;
    idToken: string;
    localId: string;
};

export type AuthResult = {
    ok: boolean;
    session?: AuthSession;
    message: string;
};

const STORAGE_API_KEY = "escape-nthu:firebaseApiKey";
const STORAGE_SESSION = "escape-nthu:authSession";
const FIREBASE_AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";

export default class FirebaseAuthClient {
    static getConfiguredApiKey(): string {
        if (typeof localStorage === "undefined") return "";
        return localStorage.getItem(STORAGE_API_KEY) || "";
    }

    static saveApiKey(apiKey: string): void {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(STORAGE_API_KEY, apiKey.trim());
    }

    static getSavedSession(): AuthSession | null {
        if (typeof localStorage === "undefined") return null;
        const raw = localStorage.getItem(STORAGE_SESSION);
        if (!raw) return null;

        try {
            return JSON.parse(raw) as AuthSession;
        } catch (_error) {
            localStorage.removeItem(STORAGE_SESSION);
            return null;
        }
    }

    static logout(): void {
        if (typeof localStorage === "undefined") return;
        localStorage.removeItem(STORAGE_SESSION);
    }

    static async register(email: string, password: string, apiKey = FirebaseAuthClient.getConfiguredApiKey()): Promise<AuthResult> {
        return FirebaseAuthClient.request("accounts:signUp", email, password, apiKey);
    }

    static async login(email: string, password: string, apiKey = FirebaseAuthClient.getConfiguredApiKey()): Promise<AuthResult> {
        return FirebaseAuthClient.request("accounts:signInWithPassword", email, password, apiKey);
    }

    private static async request(action: string, email: string, password: string, apiKey: string): Promise<AuthResult> {
        const trimmedEmail = email.trim();
        if (!apiKey.trim()) {
            return { ok: false, message: "請先在 Firebase Web API Key 欄位貼上設定" };
        }
        if (!trimmedEmail || password.length < 6) {
            return { ok: false, message: "Email 不可空白，密碼至少 6 碼" };
        }

        try {
            const response = await fetch(`${FIREBASE_AUTH_BASE}/${action}?key=${encodeURIComponent(apiKey.trim())}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmedEmail,
                    password,
                    returnSecureToken: true,
                }),
            });
            const payload = await response.json();

            if (!response.ok) {
                return { ok: false, message: FirebaseAuthClient.toMessage(payload && payload.error && payload.error.message) };
            }

            const session: AuthSession = {
                email: payload.email,
                idToken: payload.idToken,
                localId: payload.localId,
            };
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
            }
            return { ok: true, session, message: `已登入 ${session.email}` };
        } catch (_error) {
            return { ok: false, message: "Firebase 連線失敗，請檢查網路或 API key" };
        }
    }

    private static toMessage(code: string): string {
        switch (code) {
            case "EMAIL_EXISTS":
                return "這個 Email 已註冊，請改用登入";
            case "EMAIL_NOT_FOUND":
            case "INVALID_LOGIN_CREDENTIALS":
            case "INVALID_PASSWORD":
                return "Email 或密碼不正確";
            case "INVALID_EMAIL":
                return "Email 格式不正確";
            case "WEAK_PASSWORD : Password should be at least 6 characters":
                return "密碼至少需要 6 碼";
            default:
                return code || "Firebase 驗證失敗";
        }
    }
}
