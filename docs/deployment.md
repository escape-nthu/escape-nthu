# 後端部署與 Firebase 設定

這份文件對應首頁 Lobby 的欄位：後端 API URL、房號、Firebase Web API Key、Email/Password。

## 1. 本地跑後端

```bash
pnpm install
pnpm dev
```

健康檢查：

```bash
curl http://localhost:8787/health
```

Cocos 首頁的「後端 API URL」填：

```text
http://localhost:8787
```

## 2. 本地驗證 Docker

```bash
docker build -f server/Dockerfile -t escape-nthu-server .
docker run --rm -p 8787:8787 --env PORT=8787 escape-nthu-server
```

另開一個 terminal 驗證：

```bash
curl http://localhost:8787/health
```

## 3. 部署到 Render

1. 到 Render 建立 New Web Service，連到 `escape-nthu/escape-nthu` repository。
2. Runtime 選 Docker。
3. Dockerfile path 填 `server/Dockerfile`。
4. Health check path 填 `/health`。
5. Environment variables 設：
   - `HOST=0.0.0.0`
   - `PORT=10000`
   - `OPENAI_API_KEY=` 如果要啟用 AI NPC 才填
   - `OPENAI_MODEL=gpt-4o-mini`
   - `LLM_TIMEOUT_MS=8000`
6. 建立服務後，等 Render deploy 完成，複製服務 URL，例如：

```text
https://escape-nthu-server.onrender.com
```

Cocos 首頁的「後端 API URL」填 Render 的 HTTPS URL。前端會自動把 WebSocket 轉成 `wss://.../ws`。

## 4. Firebase Email/Password 註冊登入

目前 Cocos 前端透過 Firebase Authentication REST API 做 Email/Password 註冊與登入。Firebase Web API Key 不是密碼，但不要把 Admin SDK service account 放進前端。

1. 到 Firebase Console 建立或選擇專案。
2. 左側 Authentication -> Sign-in method。
3. 啟用 Email/Password provider。
4. Project settings -> General -> Your apps，新增 Web app 或使用現有 Web app。
5. 複製 `apiKey`。
6. 開遊戲首頁，在「註冊」或「登入」頁把 `apiKey` 貼到 Firebase Web API Key。
7. 輸入 Email 和至少 6 碼密碼後註冊/登入。

## 5. 目前安全邊界

- Firebase 目前只負責前端登入狀態與選單體驗。
- 後端 room API 尚未強制驗 Firebase ID token，所以多人房間仍是教學展示等級。
- 若要上正式公開環境，下一步應在後端加入 Firebase Admin token verification，並要求 room API / WebSocket 連線帶 `Authorization: Bearer <idToken>`。
