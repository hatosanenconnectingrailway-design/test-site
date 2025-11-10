// script.js
const activeAudioMap = new Map();
// PDFファイルのパス (同じフォルダにあると仮定)
const PDF_URL = "presentation.pdf"; 

// メイン要素
const canvas = document.getElementById("pdf-canvas");
const ctx = canvas.getContext("2d");
const loadingEl = document.getElementById("loading");
const controlsEl = document.getElementById("controls");
const containerEl = document.getElementById("container");
const sidebarEl = document.getElementById("sidebar"); // ★追加
const mediaMenuEl = document.getElementById("media-menu"); // ★追加
const modalEl = document.getElementById("media-modal"); // ★追加
const modalContentEl = document.querySelector("#media-modal .modal-content"); // ★追加
const closeModalBtn = document.getElementById("closeModal"); // ★追加

// PDF変数
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let autoplayTimer = null;
const autoplayInterval = 3000;

// pdf.jsのWorkerを設定
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// --- PDF関連の関数 (変更なし) ---

// ページ番号表示を更新
function updatePageInfo() {
  document.getElementById("pageInfo").innerText = `${currentPage} / ${totalPages}`;
}

// ページのレンダリング処理
async function renderPage(num) {
  if (!pdfDoc) return;
  
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: 1.0 });
  const controlsHeight = controlsEl ? controlsEl.offsetHeight : 50; 
  // サイドバーが開いている場合はその幅も考慮する必要があるが、ここでは簡略化
  const containerWidth = window.innerWidth * 0.95;
  const containerHeight = (window.innerHeight - controlsHeight) * 0.95; 
  
  const scale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
  const scaledViewport = page.getViewport({ scale });

  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  currentPage = num;
  updatePageInfo();
}

// 自動再生開始
function startAutoplay() {
  stopAutoplay();
  autoplayTimer = setInterval(() => {
    if (currentPage >= totalPages) {
      renderPage(1); 
    } else {
      renderPage(currentPage + 1);
    }
  }, autoplayInterval);
}

// 自動再生停止
function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

// --- メニュー・モーダル関連の関数 (★新規追加) ---

// サイドバーの開閉
function toggleSidebar() {
    sidebarEl.classList.toggle("open");
}

// メディアメニューの生成 (★修正)
function createMediaMenu() {
    // タイプごとにグループ化 (変更なし)
    const groupedData = mediaData.reduce((acc, item) => {
        acc[item.type] = acc[item.type] || [];
        acc[item.type].push(item);
        return acc;
    }, {});

    mediaMenuEl.innerHTML = ''; // メニューをクリア

    const typeOrder = { image: "画像", video: "動画", audio: "音声" };

    Object.keys(typeOrder).forEach(type => {
        if (groupedData[type] && groupedData[type].length > 0) {
            // グループタイトル (変更なし)
            const titleEl = document.createElement('div');
            titleEl.className = 'media-group-title';
            titleEl.textContent = typeOrder[type];
            mediaMenuEl.appendChild(titleEl);

            // リストアイテム
            groupedData[type].forEach(item => {
                const itemContainerEl = document.createElement('div'); // 全体を囲むコンテナ
                itemContainerEl.className = 'media-item-container';
                
                const itemEl = document.createElement('span');
                itemEl.className = 'media-item';
                itemEl.textContent = item.name;

                if (item.type === 'audio') {
                    // ★ 音声の場合はボタンを追加
                    itemContainerEl.classList.add('audio-item');
                    
                    const button = document.createElement('button');
                    button.textContent = "▶ 再生";
                    button.className = 'audio-control-btn';
                    button.dataset.url = item.url; // URLをデータ属性に保存
                    
                    button.addEventListener('click', () => {
                        toggleAudioPlayback(item, button);
                    });
                    
                    itemContainerEl.appendChild(itemEl);
                    itemContainerEl.appendChild(button);

                } else {
                    // ★ 画像と動画は引き続きモーダルを開く
                    itemEl.addEventListener('click', () => openMediaModal(item));
                    itemContainerEl.appendChild(itemEl);
                }
                mediaMenuEl.appendChild(itemContainerEl);
            });
        }
    });
}

// 音声の再生/停止を切り替える関数 (★新規)
function toggleAudioPlayback(item, button) {
    const url = item.url;
    let audio = activeAudioMap.get(url);

    if (audio) {
        // 既に再生中の場合
        if (audio.paused) {
            // 停止中なら再生
            audio.play();
            button.textContent = "■ 停止";
        } else {
            // 再生中なら停止
            audio.pause();
            button.textContent = "▶ 再生";
        }
    } else {
        // 新しくオーディオ要素を作成
        audio = new Audio(url);
        audio.loop = false; // ループしない
        
        // 再生終了時の処理
        audio.addEventListener('ended', () => {
            button.textContent = "▶ 再生";
            activeAudioMap.delete(url); // マップから削除
        });
        
        // エラー時の処理
        audio.addEventListener('error', () => {
             button.textContent = "⚠️ エラー";
             button.disabled = true;
             console.error(`Audio playback error for ${url}`);
             activeAudioMap.delete(url);
        });

        // 再生開始
        audio.play().catch(error => {
            console.error("Audio playback failed (user interaction required?):", error);
            button.textContent = "▶ 再生"; // 再生失敗時は表示を戻す
        });
        
        button.textContent = "■ 停止";
        activeAudioMap.set(url, audio);
    }
}


// メディア表示モーダルを開く (★修正: audioタイプを除外)
function openMediaModal(mediaItem) {
    if (mediaItem.type === 'audio') {
        // 音声はモーダルで表示しないため処理をスキップ
        return; 
    }
    
    // 既存のコンテンツをクリア (特に動画の再生を停止)
    modalContentEl.querySelectorAll(':not(.close-btn)').forEach(el => el.remove());

    let mediaElement;
    
    // タイプに応じて要素を作成
    if (mediaItem.type === 'image') {
        mediaElement = document.createElement('img');
        mediaElement.src = mediaItem.url;
        mediaElement.alt = mediaItem.name;
    } else if (mediaItem.type === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.src = mediaItem.url;
        mediaElement.controls = true; 
        mediaElement.autoplay = true; 
    } 
    // audioの処理は削除

    if (mediaElement) {
        modalContentEl.prepend(mediaElement);
        modalEl.classList.remove('hidden');
    }
}

// メディア表示モーダルを閉じる (★修正: audioの処理を完全に削除)
function closeMediaModal() {
    // 閉じるとき、動画の再生は停止させる
    modalContentEl.querySelectorAll('video').forEach(el => {
        el.pause();
        el.currentTime = 0;
    });

    // audio要素をモーダルから移動させるロジックは不要になったため削除

    modalEl.classList.add('hidden');
    
    // 閉じるボタン以外のコンテンツを削除
    modalContentEl.querySelectorAll(':not(.close-btn)').forEach(el => el.remove());
}


// --- イベントリスナー設定 ---

// PDF操作ボタン
document.getElementById("prevBtn").addEventListener("click", () => {
  stopAutoplay();
  if (currentPage > 1) renderPage(currentPage - 1);
});

document.getElementById("nextBtn").addEventListener("click", () => {
  stopAutoplay();
  if (currentPage < totalPages) renderPage(currentPage + 1);
});

document.getElementById("playBtn").addEventListener("click", startAutoplay);
document.getElementById("stopBtn").addEventListener("click", stopAutoplay);

// モーダルを閉じるボタン
closeModalBtn.addEventListener('click', closeMediaModal);
// モーダル外クリックで閉じる
modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
        closeMediaModal();
    }
});


// キーボード操作
document.addEventListener("keydown", (e) => {
  // モーダルが表示されている場合はモーダル操作を優先
  if (!modalEl.classList.contains('hidden')) {
    if (e.key === "Escape") { // ESCキーでモーダルを閉じる
        closeMediaModal();
    }
    return;
  }
    
  if (e.key === "ArrowLeft") {
    stopAutoplay();
    if (currentPage > 1) renderPage(currentPage - 1);
  } else if (e.key === "ArrowRight") {
    stopAutoplay();
    if (currentPage < totalPages) renderPage(currentPage + 1);
  } else if (e.key.toLowerCase() === "m") {
    toggleFullscreenMode();
  } else if (e.key.toLowerCase() === "s") { // 'S'でサイドバー開閉 (Mはフルスクリーンで使用中のため)
    toggleSidebar();
  }
});

// 全画面・コントロール非表示切替 (Mキーで実行)
function toggleFullscreenMode() {
    // フルスクリーンAPIの呼び出しを削除し、代わりにコントロールの表示状態をトグルする
    
    // if (!document.fullscreenElement) { // この全画面チェックは不要になる
    
    if (controlsEl.classList.contains("hidden")) {
      // もしコントロールが非表示なら、再表示する
      controlsEl.classList.remove("hidden");
    } else {
      // もしコントロールが表示中なら、非表示にする
      controlsEl.classList.add("hidden");
    }
  
    // document.exitFullscreen().catch(() => {}); // この全画面解除も削除
  }

// ウィンドウサイズ変更で再レンダリング
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderPage(currentPage), 200);
});

// ==== PDFロード処理 ====
async function loadPdf() {
  try {
    pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    totalPages = pdfDoc.numPages;
    
    loadingEl.style.display = "none";
    canvas.style.display = "block";
    
    await renderPage(1);

  } catch (e) {
    console.error("PDF読み込みエラー:", e);
    loadingEl.innerHTML = `<div class="error">PDFの読み込みに失敗しました。ファイル名を確認してください: ${e.message}</div>`;
  }
}

// アプリケーション開始
loadPdf();
createMediaMenu(); // メディアメニューの生成も開始時に実行