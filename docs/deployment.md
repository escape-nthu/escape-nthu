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
docker run --rm -p 8787:8080 escape-nthu-server
```

另開一個 terminal 驗證：

```bash
curl http://localhost:8787/health
```

## 3. 部署到 GCP Cloud Run

Cloud Run 會提供 HTTPS URL，也支援 WebSocket。後端已經讀取 Cloud Run 注入的 `PORT`，並且 bind 到 `0.0.0.0`。

以下指令假設你已安裝並登入 `gcloud` CLI。

1. 選擇專案與區域：

```bash
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>
gcloud config set run/region asia-east1
```

2. 啟用需要的 API：

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

3. 建立 Artifact Registry repository。只需要建立一次：

```bash
gcloud artifacts repositories create escape-nthu \
  --repository-format=docker \
  --location=asia-east1 \
  --description="Escape NTHU backend containers"
```

4. 從專案根目錄用 Cloud Build 建 image：

```bash
gcloud builds submit \
  --config server/cloudbuild.yaml \
  --substitutions=_REGION=asia-east1,_REPOSITORY=escape-nthu,_IMAGE=server \
  .
```

5. 部署到 Cloud Run：

```bash
gcloud run deploy escape-nthu-server \
  --image asia-east1-docker.pkg.dev/$(gcloud config get-value project)/escape-nthu/server:latest \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars HOST=0.0.0.0,OPENAI_MODEL=gpt-4o-mini,LLM_TIMEOUT_MS=8000
```

如果要啟用 AI NPC，另外設定：

```bash
gcloud run services update escape-nthu-server \
  --region asia-east1 \
  --set-env-vars OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
```

6. 部署完成後，Cloud Run 會輸出服務 URL，例如：

```text
https://escape-nthu-server-xxxxx-de.a.run.app
```

Cocos 首頁的「後端 API URL」預設已填 Cloud Run 的 HTTPS URL。前端會自動把 WebSocket 轉成 `wss://.../ws`。

Cloud Run WebSocket 注意事項：

- WebSocket 連線會被 Cloud Run 視為持續中的 request。
- Cloud Run request timeout 會影響 WebSocket 最長連線時間；前端之後若要長時間遊玩，應補重連流程。
- 目前房間狀態存在單一 process 的 memory 裡。Cloud Run 若 scale 到多個 instances，同一房間的兩位玩家可能被分到不同 instance。Demo 時建議先設定最大 instance 為 1：

```bash
gcloud run services update escape-nthu-server \
  --region asia-east1 \
  --max-instances=1
```

## 4. Firebase Email/Password 註冊登入

目前 Cocos 前端透過 Firebase Authentication REST API 做 Email/Password 註冊與登入。Firebase Web API Key 不是密碼，但不要把 Admin SDK service account 放進前端。

1. 到 Firebase Console 建立或選擇專案。
2. 左側 Authentication -> Sign-in method。
3. 啟用 Email/Password provider。
4. Project settings -> General -> Your apps，新增 Web app 或使用現有 Web app。
5. 複製 `apiKey`。目前前端已預設使用 `escape-nthu` Firebase project 的 Web API Key。
6. 開遊戲首頁，進入「註冊」或「登入」頁。
7. 輸入 Email 和至少 6 碼密碼後註冊/登入。

## 5. 目前安全邊界

- Firebase 目前只負責前端登入狀態與選單體驗。
- 後端 room API 尚未強制驗 Firebase ID token，所以多人房間仍是教學展示等級。
- 若要上正式公開環境，下一步應在後端加入 Firebase Admin token verification，並要求 room API / WebSocket 連線帶 `Authorization: Bearer <idToken>`。
