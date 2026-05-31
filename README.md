# WishShelf — 欲しいもの棚

気になったURLを画像で溜める、自分だけのウィッシュリストPWA。
URLを入れると（スクショ→og:image格上げで）画像が自動で付き、カテゴリ別の画像グリッドで一覧でき、価格を入れれば「全部揃えるといくら」が出ます。

## 同梱ファイル
- `index.html` … アプリ本体（単一ファイル）
- `manifest.json` … ホーム画面アプリ化＋Web Share Target（Android/Chrome用）
- `sw.js` … Service Worker（オフライン起動）
- `worker.js` … 金額＆画像を取得するCloudflare Worker（任意・推奨）
- `icon-192.png` / `icon-512.png` / `icon-180.png` … アイコン
- `README.md` … これ

---

## 1. GitHub Pagesに公開する（5分）

1. GitHubで新しいリポジトリを作る（例：`wishshelf`）。Publicでよい。
2. このフォルダの中身を**まるごと**そのリポジトリにアップロード（`index.html` がリポジトリ直下に来るように）。
   - 手元から：`git init && git add . && git commit -m "init" && git branch -M main && git remote add origin <repoのURL> && git push -u origin main`
   - もしくはGitHubの「Add file → Upload files」でドラッグ＆ドロップでもOK。
3. リポジトリの **Settings → Pages** を開く。
4. **Source** を `Deploy from a branch`、**Branch** を `main` / `/(root)` にして Save。
5. 1〜2分待つと `https://<ユーザー名>.github.io/wishshelf/` で公開される。

> パスはすべて相対指定にしてあるので、サブパス（`/wishshelf/`）配下でもそのまま動きます。

## 2. iPhoneのホーム画面アプリにする

1. iPhoneのSafariで公開URL（`https://<ユーザー名>.github.io/wishshelf/`）を開く。
2. 共有ボタン → **「ホーム画面に追加」**。
3. ホーム画面のWishShelfアイコンから起動すると、アドレスバーのない全画面アプリになる（オフラインでも開く）。

---

## 3. ★ 共有シートから1タップで保存する（iOSの肝）

iOSはWebアプリを共有シートに直接は出せないため、**「ショートカット」アプリで“共有シートに出る項目”を自作**します。これで〈Safariで商品ページ → 共有 → WishShelfに追加 → アプリが開いて自動でAdd画面〉が実現します。

### ショートカットの作り方
1. **ショートカット** アプリ →「+」で新規作成。
2. 上部の名前を **「WishShelfに追加」** に。アイコンも好みで。
3. 右上の設定（ⓘ）→ **「共有シートに表示」をON**。「受け取れるもの」は **URL / Safari Webページ** を残す（他はOFFでよい）。
4. アクションを追加していく（検索窓に名前を入れて選ぶ）：
   1. **「URL」** アクションを追加し、値に
      `https://<ユーザー名>.github.io/wishshelf/?url=`
      と入力（自分の公開URLに置き換える。末尾の `?url=` まで含める）。
   2. **「テキストをURLエンコード」**（"エンコード"で検索）を追加。エンコード対象は **「ショートカットの入力（Shortcut Input）」** を選ぶ。
   3. **「テキスト」** アクションを追加し、`[手順1のURL][手順2のエンコード結果]` を続けて並べる（=`...?url=` の直後にエンコード済みURLが来る形）。
   4. **「URLを開く」** アクションを追加し、対象を手順3の「テキスト」にする。
5. 完了。

### 使い方
Safari（や他アプリ）で商品ページを開く → **共有** → 一覧から **「WishShelfに追加」** をタップ → WishShelfが開いてAdd画面が立ち上がり、画像・タイトル・（取れれば）価格が入った状態になる → カテゴリを選んで「棚に追加」。

> Android / PC版Chromeでは、`manifest.json` の `share_target` が効くので**ショートカット不要**。アプリインストール後、共有メニューにWishShelfが自動で出ます。

---

## ★ 金額と綺麗な画像を自動取得する（Cloudflare Worker・無料）

これを立てると、サイトから**金額**と**商品画像**を自動で読み取って表示できます（前述のCORSの壁をサーバー側で回避）。コードは同梱の `worker.js`。

1. https://dash.cloudflare.com にログイン（無料アカウントでOK）。
2. **Workers & Pages → Create → Create Worker**。名前を `wishshelf-fetch` 等にして Deploy。
3. **Edit code** を開き、初期コードを全消し → `worker.js` の中身を全部貼り付け → **Deploy**。
4. 発行されたURL（例 `https://wishshelf-fetch.xxxx.workers.dev`）をコピー。
5. `index.html` を開き、上の方にある
   `const FETCH_API = "";`
   を
   `const FETCH_API = "https://wishshelf-fetch.xxxx.workers.dev";`
   に書き換えて保存 → GitHubに再アップ。

これで、URLを入れた瞬間に金額と商品画像が自動で入ります。動作確認は、ブラウザで
`https://wishshelf-fetch.xxxx.workers.dev/?url=https://nnine.shop/products/blue-striped-short-sleeve-shirt-n5475`
を開いて、`{"title":...,"image":...,"price":...}` が返ればOK。

> 無料枠は1日10万リクエストなので個人利用なら十分。Shopify系（nnine.shop等）は商品JSONから確実に金額・画像を取得します。それ以外の店もog:image / JSON-LDから取得を試みます。

## 4. 画像・価格の自動取得について（重要）

- 画像は **スクショサービス（image.thum.io）** を既定にしているので、どんなサイトでも必ず何か表示されます。`og:image`（商品だけの綺麗な画像）が取れた場合は自動でそちらに格上げ。違えば「画像を変える」から候補選択／URL手動貼り付けで差し替え可。
- スクショサービスは無料枠・レート制限ありの外部サービスです。本格運用するなら、自分の **Cloudflare Worker** か **Supabase Edge Function** で「URL→og:image・価格・スクショ」を返すエンドポイントを1本立て、`worker.js` を立てて `FETCH_API` に設定するのが理想（CORSの影響を受けず最も安定。↑のセクション参照）。
- データ保存は今は端末内（`window.storage`→`localStorage`→メモリの多段フォールバック）。複数端末で同期したくなったら、保存処理（`Store` オブジェクト）を Supabase に差し替えるだけでOK。

---

## カスタマイズの入口（index.html内）
- 配色：`:root` の CSS変数（`--accent` がゴールド等）
- 既定カテゴリ：`DEFAULT_CATS`
- 取得ロジック：`shotUrl()`（スクショURL生成）／`fetchMeta()`（og:image・価格）
- 保存先：`Store` オブジェクト（`get`/`set`）
